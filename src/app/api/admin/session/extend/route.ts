import { NextResponse } from "next/server";
import { body, desk } from "@/lib/api-guard";
import { isOwner } from "@/lib/auth";
import { extendExpiry, isDeskAccount } from "@/lib/reception";

/**
 * Push a member's pack expiry out, from the desk.
 *
 * Open to the whole desk — an instructor as well as the owner — because it is
 * the same kind of act as selling or comping sessions: something done for a
 * member standing at the counter, not a change to how the studio runs.
 *
 * The reception function is where the rules live (extend only, move the window
 * with the expiry, a two-year ceiling, an audit line per pack). This route is
 * the gate and the date parse, nothing more.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await desk();
  if ("res" in gate) return gate.res;

  const data = await body<{
    userId?: string;
    batchId?: string;
    all?: boolean;
    /** A calendar date, "YYYY-MM-DD". */
    newExpiry?: string;
    note?: string;
  }>(req);

  if (!data?.userId || (!data.batchId && !data.all) || !data.newExpiry) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  /* A date, not a timestamp: the desk chooses a day, and the reception function
     rounds it up to the end of that day in Larnaca. A string that is not a real
     date is refused here rather than turned into an Invalid Date downstream. */
  const parsed = new Date(`${data.newExpiry}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "BAD_DATE" }, { status: 400 });
  }

  /* Reception acts for members, not for colleagues: only the owner may touch an
     account that can open this console. Same rule as selling and granting. */
  if (!isOwner(gate.user) && isDeskAccount(data.userId)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const result = await extendExpiry({
    userId: data.userId,
    batchId: data.batchId,
    all: data.all,
    newExpiry: parsed,
    note: data.note,
    staffId: gate.user.id,
    staffName: gate.user.name,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 400 });
  }
  return NextResponse.json(result);
}
