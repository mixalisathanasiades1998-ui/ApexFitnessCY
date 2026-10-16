import { NextResponse } from "next/server";
import { body, owner } from "@/lib/api-guard";
import { isDayKey } from "@/lib/credits";
import { studioEndOfDay, studioStartOfDay } from "@/lib/time";
import {
  getWelcomeSettings,
  saveWelcomeSettings,
  welcomeSwitchedOffByServer,
  WELCOME_LIMITS,
} from "@/lib/welcome";

/**
 * The welcome offer's settings, from Admin → Pricing. Owner only.
 *
 * Dates arrive as calendar days from date inputs: "from" is the start of that
 * day in Larnaca and "until" the end of it, so an offer that runs "until the
 * 30th" covers everybody who registers on the 30th.
 */
export const dynamic = "force-dynamic";

function view() {
  const s = getWelcomeSettings();
  return {
    ...s,
    grantFrom: s.grantFrom.toISOString(),
    grantUntil: s.grantUntil?.toISOString() ?? null,
    updatedAt: s.updatedAt?.toISOString() ?? null,
    serverOff: welcomeSwitchedOffByServer(),
    limits: WELCOME_LIMITS,
  };
}

export async function GET() {
  const gate = await owner();
  if ("res" in gate) return gate.res;
  return NextResponse.json(view());
}

export async function POST(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const data = await body<{
    enabled?: boolean;
    credits?: number;
    validityDays?: number;
    grantFrom?: string;
    grantUntil?: string | null;
  }>(req);
  if (!data || typeof data.enabled !== "boolean" || !isDayKey(data.grantFrom)) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (data.grantUntil && !isDayKey(data.grantUntil)) {
    return NextResponse.json({ error: "BAD_DATES" }, { status: 400 });
  }

  const result = saveWelcomeSettings({
    enabled: data.enabled,
    credits: Number(data.credits),
    validityDays: Number(data.validityDays),
    grantFrom: studioStartOfDay(new Date(`${data.grantFrom}T12:00:00Z`)),
    grantUntil: data.grantUntil
      ? studioEndOfDay(new Date(`${data.grantUntil}T12:00:00Z`))
      : null,
    staffName: gate.user.name,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 400 });
  }
  return NextResponse.json(view());
}
