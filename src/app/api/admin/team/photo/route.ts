import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { owner } from "@/lib/api-guard";
import { db } from "@/db";
import { instructorPhotos, instructors } from "@/db/schema";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/lib/profile";

/**
 * Upload a portrait for one instructor, from the desk. Owner only.
 *
 * Stored as base64 in the database, the same way member avatars are, and the
 * instructor's `photoUrl` is pointed at the public serving route with a version
 * stamp so a re-upload shows immediately. The bytes are checked against their
 * own magic numbers, not the label the browser puts on them.
 */
export const dynamic = "force-dynamic";

const MAGIC: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

function looksLike(type: string, bytes: Uint8Array) {
  const sigs = MAGIC[type];
  if (!sigs) return false;
  const ok = sigs.some((sig) => sig.every((b, i) => bytes[i] === b));
  if (!ok) return false;
  if (type === "image/webp") {
    return String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return true;
}

export async function POST(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const form = await req.formData().catch(() => null);
  const instructorId = String(form?.get("instructorId") ?? "");
  const file = form?.get("photo");

  if (!instructorId || !(file instanceof File)) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const instructor = db
    .select({ id: instructors.id })
    .from(instructors)
    .where(eq(instructors.id, instructorId))
    .get();
  if (!instructor) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "PHOTO_TYPE" }, { status: 400 });
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json({ error: "PHOTO_TOO_LARGE" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLike(file.type, new Uint8Array(buf.subarray(0, 16)))) {
    return NextResponse.json({ error: "PHOTO_NOT_IMAGE" }, { status: 400 });
  }
  if (buf.byteLength > AVATAR_MAX_BYTES) {
    return NextResponse.json({ error: "PHOTO_TOO_LARGE" }, { status: 400 });
  }

  const now = new Date();
  const values = {
    instructorId,
    contentType: file.type,
    bytes: buf.byteLength,
    data: buf.toString("base64"),
    updatedAt: now,
  };

  const existing = db
    .select({ id: instructorPhotos.instructorId })
    .from(instructorPhotos)
    .where(eq(instructorPhotos.instructorId, instructorId))
    .get();
  if (existing) {
    db.update(instructorPhotos)
      .set(values)
      .where(eq(instructorPhotos.instructorId, instructorId))
      .run();
  } else {
    db.insert(instructorPhotos).values(values).run();
  }

  /* Point the row at the served image, version-stamped so next/image and the
     browser both pick up a re-upload at once. Editing the photo is a desk edit,
     so stamp editedAt too — the roster must not overwrite it. */
  const photoUrl = `/api/instructor-photo?id=${instructorId}&v=${now.getTime()}`;
  db.update(instructors)
    .set({ photoUrl, editedAt: now })
    .where(eq(instructors.id, instructorId))
    .run();

  return NextResponse.json({ ok: true, photoUrl });
}
