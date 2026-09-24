import { NextResponse } from "next/server";
import { body, owner } from "@/lib/api-guard";
import {
  createPromoCode,
  deletePromoCode,
  listPromoCodes,
  setPromoActive,
} from "@/lib/promo-codes";
import { studioEndOfDay, studioStartOfDay } from "@/lib/time";

/**
 * Discount codes, from the desk. Owner only.
 *
 * The from/until fields arrive as plain calendar dates from date inputs and are
 * stored as studio wall time: the start of the "from" day and the end of the
 * "until" day in Larnaca, so a code that runs "until the 30th" works all through
 * the 30th.
 */
export const dynamic = "force-dynamic";

/** A "YYYY-MM-DD" string to an instant, or null. */
function dayStart(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : studioStartOfDay(d);
}
function dayEnd(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : studioEndOfDay(d);
}

export async function GET() {
  const gate = await owner();
  if ("res" in gate) return gate.res;
  return NextResponse.json({ promos: listPromoCodes() });
}

export async function POST(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{
    code?: string;
    kind?: "PERCENT" | "FLAT";
    value?: number;
    packageId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    maxUses?: number | null;
  }>(req);

  const result = createPromoCode({
    code: String(d?.code ?? ""),
    kind: d?.kind === "FLAT" ? "FLAT" : "PERCENT",
    value: Number(d?.value),
    packageId: d?.packageId || null,
    validFrom: dayStart(d?.validFrom),
    validUntil: dayEnd(d?.validUntil),
    maxUses:
      d?.maxUses === null || d?.maxUses === undefined || d?.maxUses === 0
        ? null
        : Number(d.maxUses),
    staffId: gate.user.id,
  });
  if (!result.ok) return NextResponse.json({ error: result.code }, { status: 400 });
  return NextResponse.json({ ok: true, promos: listPromoCodes() });
}

export async function PATCH(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{ id?: string; active?: boolean }>(req);
  if (!d?.id || typeof d.active !== "boolean") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (!setPromoActive(d.id, d.active)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, promos: listPromoCodes() });
}

export async function DELETE(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{ id?: string }>(req);
  if (!d?.id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  if (!deletePromoCode(d.id)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, promos: listPromoCodes() });
}
