import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { purchases } from "@/db/schema";
import { body } from "@/lib/api-guard";
import { currentUser } from "@/lib/auth";
import { getPackageById } from "@/lib/catalogue";
import { packWindow, startAllowed } from "@/lib/credits";
import type { CreditKind } from "@/lib/packs";
import { studioDateKey } from "@/lib/time";

/**
 * Change the start day of a payment that is open but not yet paid.
 *
 * The checkout opens a payment as soon as the page loads, with the suggested
 * start day on it. Changing the date afterwards does not need a new payment —
 * the amount is the same — only the day written on this one, which is what the
 * sessions are granted with when the money lands.
 *
 * Only the member's own purchase, and only while it is still PENDING: a paid
 * purchase has already been granted, and moving its date here would say one
 * thing on the receipt and another in the balance. Moving a paid pack is the
 * desk's job.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const data = await body<{ purchaseId?: string; startsOn?: string }>(req);
  if (!data?.purchaseId || !data.startsOn) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const purchase = db
    .select()
    .from(purchases)
    .where(
      and(eq(purchases.id, data.purchaseId), eq(purchases.userId, user.id)),
    )
    .get();
  if (!purchase) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (purchase.status !== "PENDING") {
    return NextResponse.json({ error: "NOT_PENDING" }, { status: 409 });
  }

  const pkg = purchase.packageId
    ? await getPackageById(purchase.packageId)
    : undefined;
  const kind: CreditKind =
    pkg?.kind === "PERSONAL" || pkg?.kind === "DUET" ? pkg.kind : "CLASS";

  if (!startAllowed(user.id, kind, data.startsOn)) {
    return NextResponse.json({ error: "BAD_START" }, { status: 400 });
  }

  const window = packWindow(data.startsOn, pkg?.validityDays ?? null);
  const res = db
    .update(purchases)
    .set({ startsOn: window.startsOn })
    .where(
      and(eq(purchases.id, purchase.id), eq(purchases.status, "PENDING")),
    )
    .run();
  /* Paid between the read above and this write: the sessions were granted
     with the day that was on it then, so this change did not happen. */
  if (res.changes === 0) {
    return NextResponse.json({ error: "NOT_PENDING" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    startsOn: window.startsOn,
    expiresOn: window.expiresAt ? studioDateKey(window.expiresAt) : null,
  });
}
