import { NextResponse } from "next/server";
import { body, owner } from "@/lib/api-guard";
import { bulkExtendPreview, extendAllActive } from "@/lib/reception";

/**
 * Extend every active pack in the studio by the same number of days.
 *
 * Owner only. Moving one member's expiry is an everyday desk act; moving every
 * member's at once is a decision about how the studio runs, like a closure or a
 * price, so it sits behind the same door as those.
 *
 * GET says what it would touch, for the confirmation sentence. POST does it.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await owner();
  if ("res" in gate) return gate.res;
  return NextResponse.json(bulkExtendPreview());
}

export async function POST(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const data = await body<{ days?: number; ref?: string; note?: string }>(req);
  const days = Number(data?.days);
  /* The ref is matched inside the ledger notes, so it is held to a plain shape:
     letters, digits and dashes, which is what the page generates. */
  const ref = typeof data?.ref === "string" ? data.ref : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(ref)) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const result = extendAllActive({
    days,
    ref,
    staffName: gate.user.name,
    note: typeof data?.note === "string" ? data.note.slice(0, 120) : undefined,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code },
      { status: result.code === "ALREADY_DONE" ? 409 : 400 },
    );
  }
  return NextResponse.json(result);
}
