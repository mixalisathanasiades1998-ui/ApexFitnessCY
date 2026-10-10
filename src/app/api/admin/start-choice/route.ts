import { NextResponse } from "next/server";
import { desk } from "@/lib/api-guard";
import { startChoices } from "@/lib/credits";
import type { CreditKind } from "@/lib/packs";

/**
 * The start day to suggest when the desk sells a member a pack.
 *
 * The same rule a member sees at checkout, so a pack sold at the counter and a
 * pack bought online start on the same day for the same person.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await desk();
  if ("res" in gate) return gate.res;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  const k = url.searchParams.get("kind");
  const kind: CreditKind = k === "PERSONAL" || k === "DUET" ? k : "CLASS";
  return NextResponse.json(startChoices(userId, kind));
}
