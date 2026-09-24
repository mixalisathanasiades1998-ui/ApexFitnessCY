import { eq } from "drizzle-orm";
import { db } from "@/db";
import { promoCodes } from "@/db/schema";

/**
 * Discount codes a member types at checkout.
 *
 * Different from the shopfront offer in pricing.ts: that shows a struck-through
 * price to everyone; a code is entered by one member, applies to one purchase,
 * is counted so a "first fifty" cap can mean something, and can be scoped to a
 * single pack. Counted on fulfilment, never at checkout, so an abandoned payment
 * never spends a use.
 */

/** The smallest a discounted charge may fall to, so no code makes a pack free. */
const FLOOR_CENTS = 100;

export type PromoState = "LIVE" | "OFF" | "SCHEDULED" | "EXPIRED" | "USED_UP";

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

function stateOf(
  row: {
    active: boolean;
    validFrom: Date | null;
    validUntil: Date | null;
    maxUses: number | null;
    uses: number;
  },
  now = new Date(),
): PromoState {
  if (!row.active) return "OFF";
  if (row.maxUses != null && row.uses >= row.maxUses) return "USED_UP";
  if (row.validFrom && now.getTime() < row.validFrom.getTime()) return "SCHEDULED";
  if (row.validUntil && now.getTime() > row.validUntil.getTime()) return "EXPIRED";
  return "LIVE";
}

export type PromoView = {
  id: string;
  code: string;
  kind: "PERCENT" | "FLAT";
  value: number;
  packageId: string | null;
  active: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  maxUses: number | null;
  uses: number;
  state: PromoState;
};

export function listPromoCodes(): PromoView[] {
  const now = new Date();
  return db
    .select()
    .from(promoCodes)
    .all()
    .map((r) => ({
      id: r.id,
      code: r.code,
      kind: r.kind === "FLAT" ? "FLAT" : "PERCENT",
      value: r.value,
      packageId: r.packageId,
      active: r.active,
      validFrom: r.validFrom,
      validUntil: r.validUntil,
      maxUses: r.maxUses,
      uses: r.uses,
      state: stateOf(r, now),
    }));
}

/** What a code takes off a list price, capped so the charge stays >= €1. */
export function discountFor(
  code: string,
  listCents: number,
): { off: number; charge: number } {
  const row = db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, normaliseCode(code)))
    .get();
  if (!row || stateOf(row) !== "LIVE") return { off: 0, charge: listCents };

  const raw =
    row.kind === "FLAT"
      ? row.value
      : Math.round((listCents * row.value) / 100);
  const charge = Math.max(FLOOR_CENTS, listCents - raw);
  return { off: listCents - charge, charge };
}

export type PromoCheck =
  | { ok: true; code: string }
  | { ok: false };

/**
 * Is this code good for this pack, right now? Used by checkout before charging.
 *
 * A code with no package applies to the whole list; a code scoped to one pack
 * only helps that pack. A code that saves nothing here (its floor already met,
 * or the pack too cheap) is not a valid discount to apply.
 */
export function checkPromo(code: string, packageId: string): PromoCheck {
  const norm = normaliseCode(code);
  const row = db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, norm))
    .get();
  if (!row || stateOf(row) !== "LIVE") return { ok: false };
  if (row.packageId != null && row.packageId !== packageId) return { ok: false };
  return { ok: true, code: norm };
}

/**
 * Spend one use. Called once, on fulfilment, inside the same claim that grants
 * the sessions — never at checkout, so an abandoned payment costs no use. The
 * conditional update means a race cannot push `uses` past `maxUses`.
 */
export function consumePromo(code: string): void {
  const norm = normaliseCode(code);
  const row = db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, norm))
    .get();
  if (!row) return;
  db.update(promoCodes)
    .set({ uses: row.uses + 1 })
    .where(eq(promoCodes.id, row.id))
    .run();
}

/* --------------------------------------------------------------- the desk */

export type CreatePromoInput = {
  code: string;
  kind: "PERCENT" | "FLAT";
  value: number;
  packageId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  maxUses: number | null;
  staffId: string;
};

export type CreatePromoResult =
  | { ok: true; id: string }
  | { ok: false; code: "BAD_INPUT" | "TAKEN" };

export function createPromoCode(input: CreatePromoInput): CreatePromoResult {
  const code = normaliseCode(input.code);
  const kind = input.kind === "FLAT" ? "FLAT" : "PERCENT";
  const value = Math.round(input.value);
  const valid =
    code.length >= 2 &&
    code.length <= 40 &&
    Number.isFinite(value) &&
    value > 0 &&
    (kind === "PERCENT" ? value <= 90 : value <= 50000) &&
    (input.maxUses == null || (Number.isInteger(input.maxUses) && input.maxUses > 0));
  if (!valid) return { ok: false, code: "BAD_INPUT" };

  const clash = db
    .select({ id: promoCodes.id })
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .get();
  if (clash) return { ok: false, code: "TAKEN" };

  const row = db
    .insert(promoCodes)
    .values({
      code,
      kind,
      value,
      packageId: input.packageId,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      maxUses: input.maxUses,
      createdBy: input.staffId,
    })
    .returning()
    .get();
  return { ok: true, id: row.id };
}

export function setPromoActive(id: string, active: boolean): boolean {
  const res = db
    .update(promoCodes)
    .set({ active })
    .where(eq(promoCodes.id, id))
    .run();
  return res.changes > 0;
}

export function deletePromoCode(id: string): boolean {
  const res = db.delete(promoCodes).where(eq(promoCodes.id, id)).run();
  return res.changes > 0;
}
