import { NextResponse } from "next/server";
import { body, owner } from "@/lib/api-guard";
import { moveClass } from "@/lib/class-move";
import { notifyClassMoved } from "@/lib/messaging/events";

/**
 * Move a class to another time: this class only, or the same slot every week
 * from this day on. Owner only, like the rest of the timetable.
 *
 * The rules live in `moveClass`. The members whose bookings moved are told
 * afterwards, outside the request's answer: the classes have moved whatever the
 * mail server does.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const data = await body<{
    sessionId?: string;
    newStart?: string;
    scope?: string;
  }>(req);
  if (
    typeof data?.sessionId !== "string" ||
    !data.sessionId ||
    typeof data.newStart !== "string" ||
    (data.scope !== "ONE" && data.scope !== "WEEKLY")
  ) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const result = moveClass({
    sessionId: data.sessionId,
    newStart: data.newStart,
    scope: data.scope,
    staffName: gate.user.name,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, clashAt: result.clashAt ?? null },
      { status: result.code === "NOT_FOUND" ? 404 : 400 },
    );
  }

  const { movedFor, ...answer } = result;
  if (movedFor && movedFor.length > 0) {
    void notifyClassMoved(movedFor, {
      weeklyFrom: result.scope === "WEEKLY" ? new Date(result.startsAt) : undefined,
      by: gate.user.name,
    }).catch(() => {});
  }
  return NextResponse.json(answer);
}
