import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { instructorPhotos } from "@/db/schema";

/**
 * An instructor's uploaded portrait, served to anyone.
 *
 * Public on purpose: it is shown on the studio page to every visitor, signed in
 * or not, so unlike a member's avatar there is no sign-in check. Stored as
 * base64 in the database (see the desk upload route) and handed back with a
 * cache tag that changes when the photo does, so a re-upload shows at once.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse(null, { status: 400 });

  const row = db
    .select()
    .from(instructorPhotos)
    .where(eq(instructorPhotos.instructorId, id))
    .get();
  if (!row) return new NextResponse(null, { status: 404 });

  const body = Buffer.from(row.data, "base64");
  return new NextResponse(body, {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: `"${row.updatedAt.getTime()}"`,
    },
  });
}
