import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, isVerified, verifyPassword } from "@/lib/auth";
import { clientIp, hit, peek, tooMany } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

/**
 * Guessing budget for one address: ten WRONG tries a quarter hour.
 *
 * Only failures are counted. A correct password passes free, so a working
 * member is never rate-limited by signing in — and the whole budget is there for
 * the guesser, who produces nothing but failures. Counted per IP rather than per
 * email so that one address probing many accounts meets the same wall that stops
 * it hammering one, and so an attacker naming a member's address can never lock
 * that member out.
 *
 * bcrypt at cost 11 already taxes each guess about a sixth of a second; this
 * puts a ceiling on top of the tax.
 */
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const gate = peek("login", ip, LOGIN_LIMIT);
  if (!gate.ok) return tooMany(gate.retryAfter);

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    /* A wrong answer spends one from the budget; a right one never does. */
    hit("login", ip, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  await createSession(user);
  return NextResponse.json({
    ok: true,
    /**
     * Somebody signing in to an account they never confirmed.
     *
     * They are let in — the password was right, and the account is theirs — and
     * then sent to the code box rather than to the timetable. The alternative is
     * worse than a redirect: they land on a page that looks like every other
     * member's, press Book, and are refused by a rule nobody has mentioned to
     * them since the day they registered.
     */
    verify: !isVerified(user),
    user: { id: user.id, name: user.name, role: user.role },
  });
}
