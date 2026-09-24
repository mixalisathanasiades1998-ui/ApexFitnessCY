import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { instructors } from "@/db/schema";
import { INSTRUCTOR_PHOTOS } from "./packs";

/**
 * The team, edited from the desk.
 *
 * The database is the team; `roster.ts` is only the starting point that fills an
 * empty table and keeps un-edited rows in step with the code. The moment the desk
 * edits an instructor it stamps `editedAt`, and the roster sync lets that row go.
 * Nobody is ever deleted — hiding sets `active` false so past classes keep the
 * name — so this has an add, an edit, a hide and a restore, and no remove.
 */

const BIO_MAX = 600;

export type TeamMember = {
  id: string;
  name: string;
  bioEn: string;
  bioEl: string;
  photoUrl: string | null;
  active: boolean;
  sortOrder: number;
};

/** A portrait address the studio may keep: a site path, or an https URL. */
function cleanPhoto(url: string | undefined | null): string {
  const v = (url ?? "").trim();
  if (v.startsWith("/") || v.startsWith("https://")) return v;
  return "";
}

function view(r: typeof instructors.$inferSelect): TeamMember {
  return {
    id: r.id,
    name: r.name,
    bioEn: r.bioEn,
    bioEl: r.bioEl,
    /* A row's own photo wins; otherwise the shipped portrait by name, so a card
       has a face without a re-seed. */
    photoUrl: r.photoUrl ?? INSTRUCTOR_PHOTOS[r.name] ?? null,
    active: r.active,
    sortOrder: r.sortOrder,
  };
}

/** Everyone, active first then by sort order. Hidden instructors included, so
 *  the desk can restore them. */
export function listTeam(): TeamMember[] {
  return db
    .select()
    .from(instructors)
    .orderBy(desc(instructors.active), asc(instructors.sortOrder))
    .all()
    .map(view);
}

export type TeamInput = {
  name: string;
  bioEn?: string;
  bioEl?: string;
  photoUrl?: string;
};

export type TeamResult =
  | { ok: true; member: TeamMember }
  | { ok: false; code: "BAD_INPUT" | "NAME_TAKEN" | "NOT_FOUND" };

export function addTeamMember(input: TeamInput): TeamResult {
  const name = input.name.trim();
  if (
    name.length < 2 ||
    name.length > 80 ||
    (input.bioEn ?? "").length > BIO_MAX ||
    (input.bioEl ?? "").length > BIO_MAX
  ) {
    return { ok: false, code: "BAD_INPUT" };
  }
  const clash = db
    .select({ id: instructors.id })
    .from(instructors)
    .where(eq(instructors.name, name))
    .get();
  if (clash) return { ok: false, code: "NAME_TAKEN" };

  const last = db
    .select({ sortOrder: instructors.sortOrder })
    .from(instructors)
    .orderBy(desc(instructors.sortOrder))
    .get();

  const row = db
    .insert(instructors)
    .values({
      name,
      bioEn: (input.bioEn ?? "").trim(),
      bioEl: (input.bioEl ?? "").trim(),
      photoUrl: cleanPhoto(input.photoUrl) || null,
      active: true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      editedAt: new Date(),
    })
    .returning()
    .get();
  return { ok: true, member: view(row) };
}

export type TeamPatch = {
  name?: string;
  bioEn?: string;
  bioEl?: string;
  photoUrl?: string;
  active?: boolean;
};

export function updateTeamMember(id: string, patch: TeamPatch): TeamResult {
  const row = db
    .select()
    .from(instructors)
    .where(eq(instructors.id, id))
    .get();
  if (!row) return { ok: false, code: "NOT_FOUND" };

  const name = patch.name?.trim();
  if (name !== undefined && (name.length < 2 || name.length > 80)) {
    return { ok: false, code: "BAD_INPUT" };
  }
  if ((patch.bioEn ?? "").length > BIO_MAX || (patch.bioEl ?? "").length > BIO_MAX) {
    return { ok: false, code: "BAD_INPUT" };
  }
  if (name !== undefined && name !== row.name) {
    const clash = db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.name, name))
      .get();
    if (clash) return { ok: false, code: "NAME_TAKEN" };
  }

  db.update(instructors)
    .set({
      name: name ?? row.name,
      bioEn: patch.bioEn !== undefined ? patch.bioEn.trim() : row.bioEn,
      bioEl: patch.bioEl !== undefined ? patch.bioEl.trim() : row.bioEl,
      photoUrl:
        patch.photoUrl !== undefined
          ? cleanPhoto(patch.photoUrl) || null
          : row.photoUrl,
      active: patch.active ?? row.active,
      editedAt: new Date(),
    })
    .where(eq(instructors.id, id))
    .run();

  const fresh = db
    .select()
    .from(instructors)
    .where(eq(instructors.id, id))
    .get();
  return fresh
    ? { ok: true, member: view(fresh) }
    : { ok: false, code: "NOT_FOUND" };
}
