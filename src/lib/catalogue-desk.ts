import { randomBytes } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditPackages, purchases } from "@/db/schema";
import { groupOf, type PackGroup } from "./packs";

/**
 * The desk's own editing of the price list.
 *
 * `packs.ts` writes the opening list into an empty database and keeps governing
 * every pack the studio has never touched. The moment the owner edits a pack
 * here it stamps `editedAt`, and from then on the boot sync leaves that row
 * alone (see catalogue-repair): the row belongs to the desk. That is the whole
 * trick — no second source of truth, just a line past which each row stops
 * following the code and starts following the desk.
 */

/** The headings a pack may sit under on the pricing page. */
export const PACK_GROUPS: readonly PackGroup[] = [
  "single",
  "month",
  "quarter",
  "half",
  "nine",
  "personal",
];

export type DeskPack = {
  id: string;
  slug: string;
  nameEn: string;
  nameEl: string;
  credits: number;
  priceCents: number;
  validityDays: number;
  kind: string;
  seats: number;
  badge: string | null;
  active: boolean;
  sortOrder: number;
  group: PackGroup;
  editedAt: Date | null;
};

function resolveGroup(row: {
  slug: string;
  packGroup: string | null;
}): PackGroup {
  return (row.packGroup as PackGroup | null) ?? groupOf(row.slug);
}

/** Every pack, on-sale first then by sort order, with its heading resolved. */
export function listPacks(): DeskPack[] {
  const rows = db
    .select()
    .from(creditPackages)
    .orderBy(desc(creditPackages.active), asc(creditPackages.sortOrder))
    .all();
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nameEn: r.nameEn,
    nameEl: r.nameEl,
    credits: r.credits,
    priceCents: r.priceCents,
    validityDays: r.validityDays,
    kind: r.kind,
    seats: r.seats,
    badge: r.badge,
    active: r.active,
    sortOrder: r.sortOrder,
    group: resolveGroup(r),
    editedAt: r.editedAt,
  }));
}

export type PackPatch = {
  nameEn?: string;
  nameEl?: string;
  credits?: number;
  priceCents?: number;
  validityDays?: number;
  group?: string;
  active?: boolean;
};

export type PackInput = {
  nameEn: string;
  nameEl: string;
  credits: number;
  priceCents: number;
  validityDays: number;
  group: string;
};

type DeskResult =
  | { ok: true; pack: DeskPack }
  | { ok: false; code: "NOT_FOUND" | "BAD_INPUT" };

/** Shared bounds. The panel checks these too, in the reader's language. */
function badCredits(n: number | undefined) {
  return n !== undefined && (!Number.isInteger(n) || n < 1 || n > 500);
}
function badPrice(n: number | undefined) {
  return n !== undefined && (!Number.isInteger(n) || n < 100);
}
function badDays(n: number | undefined) {
  return n !== undefined && (!Number.isInteger(n) || n < 1 || n > 1095);
}
function badGroup(g: string | undefined) {
  return g !== undefined && !PACK_GROUPS.includes(g as PackGroup);
}

/**
 * Edit one pack. Stamps `editedAt` so the boot sync lets go of the row, and
 * `priceEditedAt` only when the price actually moves, and freezes the heading
 * into `packGroup`.
 */
export function updatePack(id: string, patch: PackPatch): DeskResult {
  const row = db
    .select()
    .from(creditPackages)
    .where(eq(creditPackages.id, id))
    .get();
  if (!row) return { ok: false, code: "NOT_FOUND" };

  /* Either language is enough; the blank one copies the other, so a pack never
     carries an empty name. Names are reconsidered only when at least one is
     sent. */
  const sentName = patch.nameEn !== undefined || patch.nameEl !== undefined;
  const nameEn = sentName
    ? patch.nameEn?.trim() || patch.nameEl?.trim() || ""
    : row.nameEn;
  const nameEl = sentName
    ? patch.nameEl?.trim() || patch.nameEn?.trim() || ""
    : row.nameEl;

  if (
    (sentName && (nameEn.length < 2 || nameEn.length > 80)) ||
    badCredits(patch.credits) ||
    badPrice(patch.priceCents) ||
    badDays(patch.validityDays) ||
    badGroup(patch.group)
  ) {
    return { ok: false, code: "BAD_INPUT" };
  }

  const now = new Date();
  const priceChanged =
    patch.priceCents !== undefined && patch.priceCents !== row.priceCents;

  db.update(creditPackages)
    .set({
      nameEn,
      nameEl,
      credits: patch.credits ?? row.credits,
      priceCents: patch.priceCents ?? row.priceCents,
      validityDays: patch.validityDays ?? row.validityDays,
      active: patch.active ?? row.active,
      packGroup: (patch.group as PackGroup | undefined) ?? resolveGroup(row),
      editedAt: now,
      priceEditedAt: priceChanged ? now : row.priceEditedAt,
    })
    .where(eq(creditPackages.id, id))
    .run();

  return single(id);
}

/** Create a pack of the desk's own, with a slug that can never clash with the
 *  code list. */
export function createPack(input: PackInput): DeskResult {
  /* Either language is enough; the blank one copies the other. */
  const nameEn = input.nameEn?.trim() || input.nameEl?.trim() || "";
  const nameEl = input.nameEl?.trim() || input.nameEn?.trim() || "";
  if (
    nameEn.length < 2 ||
    nameEn.length > 80 ||
    badCredits(input.credits) ||
    badPrice(input.priceCents) ||
    badDays(input.validityDays) ||
    badGroup(input.group)
  ) {
    return { ok: false, code: "BAD_INPUT" };
  }

  const last = db
    .select({ sortOrder: creditPackages.sortOrder })
    .from(creditPackages)
    .orderBy(desc(creditPackages.sortOrder))
    .get();

  const now = new Date();
  const pack = db
    .insert(creditPackages)
    .values({
      slug: `desk-${randomBytes(4).toString("hex")}`,
      nameEn,
      nameEl,
      credits: input.credits,
      priceCents: input.priceCents,
      validityDays: input.validityDays,
      kind: "CLASS",
      seats: 1,
      badge: null,
      active: true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      packGroup: input.group as PackGroup,
      editedAt: now,
      priceEditedAt: now,
    })
    .returning()
    .get();

  return single(pack.id);
}

/**
 * Remove a pack, unless a member's history points at it.
 *
 * A sold pack is never deleted: its row is what a purchase and its invoice name,
 * and deleting it would rewrite history the studio may have to answer for. The
 * desk takes it off sale instead. A pack nobody has bought can go.
 */
export function deletePack(id: string): { ok: true } | { ok: false; code: "SOLD" | "NOT_FOUND" } {
  const row = db
    .select({ id: creditPackages.id })
    .from(creditPackages)
    .where(eq(creditPackages.id, id))
    .get();
  if (!row) return { ok: false, code: "NOT_FOUND" };

  const sold = db
    .select({ id: purchases.id })
    .from(purchases)
    .where(eq(purchases.packageId, id))
    .get();
  if (sold) return { ok: false, code: "SOLD" };

  /* Offers scoped to it cascade; promo codes scoped to it fall back to the whole
     list (both set in the schema's foreign keys). */
  db.delete(creditPackages).where(eq(creditPackages.id, id)).run();
  return { ok: true };
}

function single(id: string): DeskResult {
  const r = db
    .select()
    .from(creditPackages)
    .where(eq(creditPackages.id, id))
    .get();
  if (!r) return { ok: false, code: "NOT_FOUND" };
  return {
    ok: true,
    pack: {
      id: r.id,
      slug: r.slug,
      nameEn: r.nameEn,
      nameEl: r.nameEl,
      credits: r.credits,
      priceCents: r.priceCents,
      validityDays: r.validityDays,
      kind: r.kind,
      seats: r.seats,
      badge: r.badge,
      active: r.active,
      sortOrder: r.sortOrder,
      group: resolveGroup(r),
      editedAt: r.editedAt,
    },
  };
}
