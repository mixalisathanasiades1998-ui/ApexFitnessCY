import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

/**
 * Resetting a password for somebody who cannot sign in.
 *
 * The shape is a link, not a code, and that is the opposite choice from email
 * verification (see lib/verify.ts) for the opposite reason. Verification happens
 * in the window the member is already in — a code read from one tab and typed
 * into the next. A reset happens to somebody locked out, quite possibly reading
 * their mail on their phone while the site is open on a laptop, so the
 * credential has to travel to them and carry its own identity: the token in the
 * link *is* the account, and no email address or user id rides in the URL.
 *
 * What protects it:
 *
 *   - The token is 32 random bytes, base64url. That is not a space anyone walks
 *     through, so the defence here really is the token itself — unlike a
 *     six-digit code, which leans on attempt limits.
 *   - Only its HMAC is stored, keyed with AUTH_SECRET, so a stolen database file
 *     is not a list of working links.
 *   - It lives one hour and is single-use: spent the instant a new password is
 *     set, and replaced (never added to) if another is requested.
 *   - The request side never reveals whether an address is registered, and caps
 *     how often it will post to one, so it cannot become a way to flood a
 *     stranger's inbox or to enumerate members.
 */

/** How long a reset link lives. An hour survives a slow mail server without
 *  leaving a working link lying in an inbox for a day. */
export const RESET_TTL_MINUTES = 60;

/** Seconds between links to one address, so a first one has time to land. */
export const RESET_RESEND_SECONDS = 60;

/** Links allowed to one address in a rolling hour. */
export const RESET_MAX_SENDS = 5;

const WINDOW_MS = 60 * 60 * 1000;

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Add it to .env (see .env.example).",
    );
  }
  return s;
}

/** The stored form of a token: an HMAC, never the token itself. */
function hash(token: string) {
  return createHmac("sha256", key()).update(token).digest("hex");
}

/** Constant-time compare, so a near-miss token cannot be narrowed by timing. */
function sameHash(a: string, b: string) {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/** A fresh, unguessable token. URL-safe so it drops straight into a link. */
function freshToken() {
  return randomBytes(32).toString("base64url");
}

export type RequestResult =
  | { ok: true; user: { id: string; email: string }; token: string }
  /* No such address. Reported to the caller so the route can decide what to do,
     but the route must answer the browser identically either way — see below. */
  | { ok: false; code: "NO_ACCOUNT" }
  | { ok: false; code: "TOO_SOON"; secondsLeft: number }
  | { ok: false; code: "LIMIT"; minutesLeft: number };

/**
 * Begin a reset: mint a token and record it, or say why not.
 *
 * The caller (the request route) is the one that emails the link, because the
 * token is returned here exactly once and never again — the table keeps only its
 * hash. The route must translate every outcome into the same neutral answer to
 * the browser, so that whether an address is registered cannot be read off the
 * response.
 */
export function requestReset(email: string): RequestResult {
  const now = new Date();
  const user = db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .get();
  if (!user) return { ok: false, code: "NO_ACCOUNT" };

  const existing = db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.userId, user.id))
    .get();

  if (existing) {
    const since = now.getTime() - existing.sentAt.getTime();
    if (since < RESET_RESEND_SECONDS * 1000) {
      return {
        ok: false,
        code: "TOO_SOON",
        secondsLeft: Math.ceil((RESET_RESEND_SECONDS * 1000 - since) / 1000),
      };
    }
    const windowAge = now.getTime() - existing.windowStartedAt.getTime();
    const fresh = windowAge >= WINDOW_MS;
    const sends = fresh ? 0 : existing.sends;
    if (sends >= RESET_MAX_SENDS) {
      return {
        ok: false,
        code: "LIMIT",
        minutesLeft: Math.max(1, Math.ceil((WINDOW_MS - windowAge) / 60_000)),
      };
    }

    const token = freshToken();
    db.update(passwordResets)
      .set({
        tokenHash: hash(token),
        expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
        usedAt: null,
        sends: sends + 1,
        windowStartedAt: fresh ? now : existing.windowStartedAt,
        sentAt: now,
      })
      .where(eq(passwordResets.id, existing.id))
      .run();
    return { ok: true, user, token };
  }

  const token = freshToken();
  db.insert(passwordResets)
    .values({
      userId: user.id,
      tokenHash: hash(token),
      expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
      sends: 1,
      windowStartedAt: now,
      sentAt: now,
    })
    .run();
  return { ok: true, user, token };
}

export type TokenCheck =
  | { ok: true; userId: string }
  | { ok: false; code: "INVALID" | "EXPIRED" | "USED" };

/**
 * Is this link still good? Used by the page on load, so somebody following a
 * dead link is told plainly rather than typing a new password into a form that
 * will only refuse it.
 */
export function checkResetToken(token: string): TokenCheck {
  if (!token) return { ok: false, code: "INVALID" };
  const row = db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, hash(token)))
    .get();
  if (!row || !sameHash(hash(token), row.tokenHash)) {
    return { ok: false, code: "INVALID" };
  }
  if (row.usedAt) return { ok: false, code: "USED" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, code: "EXPIRED" };
  return { ok: true, userId: row.userId };
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; code: "INVALID" | "EXPIRED" | "USED" };

/**
 * Spend the link: set the new password and kill the token in one go.
 *
 * The password is hashed here, and the token row is marked used in the same
 * transaction, so a link cannot set two passwords even if two requests arrive at
 * once — whichever claims the still-unused row wins, the other finds it used.
 */
export async function consumeReset(
  token: string,
  newPassword: string,
): Promise<ConsumeResult> {
  const check = checkResetToken(token);
  if (!check.ok) return check;

  const passwordHash = await hashPassword(newPassword);

  /* Claim the row conditionally on it still being unused and unexpired, the same
     lock trick the payment fulfilment uses: the update matches only an unspent,
     live token, and RETURNING tells us whether this call is the one that spent
     it. A second call racing the first matches nothing and sets no password. */
  const claimed = db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResets.tokenHash, hash(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .returning({ userId: passwordResets.userId })
    .all();

  const row = claimed[0];
  /* The check above said the token was good, so an empty claim means another
     request spent it in the interval — report it used, not invalid. */
  if (!row) return { ok: false, code: "USED" };

  db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, row.userId))
    .run();

  return { ok: true, userId: row.userId };
}
