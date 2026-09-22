import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, hit, peek, tooMany } from "@/lib/rate-limit";
import { requestReset } from "@/lib/password-reset";
import { sendPasswordReset } from "@/lib/messaging/events";
import { RESET_TTL_MINUTES } from "@/lib/password-reset";
import { siteUrl } from "@/lib/stripe";

/**
 * "I forgot my password" — step one: email a link, if the address is real.
 *
 * The answer to the browser is the same whatever happens: a link was sent if
 * the address belongs to an account, and the screen says so without confirming
 * or denying that it does. That neutrality is the point — a reset form that
 * says "no such account" is a way to find out who is a member, and one that says
 * "sent!" only for real addresses is the same thing said more quietly. So this
 * always returns ok, and does the real work behind that.
 *
 * A per-IP cap sits on top, because the one thing this route can be abused for
 * regardless of enumeration is volume: posting reset mail at a stranger's inbox.
 */
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/** Requests per IP a quarter hour. Generous for a person, mean for a script. */
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const gate = peek("reset", ip, LIMIT);
  if (!gate.ok) return tooMany(gate.retryAfter);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  /* A malformed address is the one thing worth saying out loud: it is the
     sender's own typo, not a fact about who is registered. */
  if (!parsed.success) {
    return NextResponse.json({ error: "EMAIL_INVALID" }, { status: 400 });
  }

  /* Spend one from the budget on every attempt, right or wrong. Unlike login,
     there is no "correct" answer that should pass free here — the whole route is
     unauthenticated by nature. */
  hit("reset", ip, LIMIT, WINDOW_MS);

  const result = requestReset(parsed.data.email);
  if (result.ok) {
    const link = `${siteUrl()}/reset?token=${encodeURIComponent(result.token)}`;
    /* Awaited, unlike most notifications: the screen is about to tell the person
       to check their inbox, and if the send threw we would still rather log it
       than pretend. It never changes the neutral answer, though. */
    try {
      await sendPasswordReset(result.user.email, link, RESET_TTL_MINUTES);
    } catch (err) {
      console.error("[reset] could not send the reset link", err);
    }
  }

  /* Always the same. See the note at the top. */
  return NextResponse.json({ ok: true });
}
