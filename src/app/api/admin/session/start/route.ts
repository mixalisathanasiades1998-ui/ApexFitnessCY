import { NextResponse } from "next/server";
import { body, desk } from "@/lib/api-guard";
import { isOwner } from "@/lib/auth";
import { isDeskAccount, moveStart } from "@/lib/reception";

/**
 * Move the start day of a member's unused pack, from the desk.
 *
 * Open to the whole desk, like extending a pack: something done for a member
 * at the counter. The rules live in `moveStart`; this is the gate.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await desk();
  if ("res" in gate) return gate.res;

  const data = await body<{
    userId?: string;
    batchId?: string;
    startsOn?: string;
  }>(req);
  if (!data?.userId || !data.batchId || !data.startsOn) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (!isOwner(gate.user) && isDeskAccount(data.userId)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const result = moveStart({
    userId: data.userId,
    batchId: data.batchId,
    startsOn: data.startsOn,
    staffName: gate.user.name,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 400 });
  }
  return NextResponse.json(result);
}
