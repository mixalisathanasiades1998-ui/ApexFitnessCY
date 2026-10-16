import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditBatches, users, welcomeOffer } from "@/db/schema";
import { grantCredits } from "./credits";
import {
  studioAddDays,
  studioDateKey,
  studioEndOfDay,
  studioWallTimeToInstant,
} from "./time";

/**
 * The welcome offer: free group sessions for every new account.
 *
 * Unlike the September opening week, nothing here is written into the code.
 * The owner turns it on and off and sets how many sessions, for how many days,
 * and for accounts created between which dates, from Admin → Pricing. Until
 * the card is first saved, the defaults below apply.
 *
 * The life of one welcome session:
 *
 *   1. **Registration** stamps the account with what the offer is at that
 *      moment (`stampWelcome`). Somebody who signs up while it says "1 free
 *      session for 30 days" is owed exactly that, even if the studio switches
 *      the offer off before they confirm their email.
 *   2. **Email confirmed** grants it (`grantWelcome`): group classes only,
 *      usable for the stamped number of days, then the email, push and in-app
 *      message. An address nobody can read is never given anything.
 *   3. **A group pack bought** while it is unused, or booked on a class that
 *      has not happened yet, keeps it for after the pack — see
 *      `welcomeFollowsPack` in credits.ts.
 *
 * `PROMO_ENABLED=false` in the server's environment still switches every
 * offer off. The test suites rely on it, and the admin card says so plainly if
 * it is set, so nobody wonders why the switch on screen does nothing.
 */

const ROW_ID = "welcome";

export type WelcomeSettings = {
  enabled: boolean;
  credits: number;
  validityDays: number;
  grantFrom: Date;
  grantUntil: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
};

/** What applies before the owner has saved the card: agreed with the studio. */
export const WELCOME_DEFAULTS: WelcomeSettings = {
  enabled: true,
  credits: 1,
  validityDays: 30,
  /* Monday 19 October 2026, midnight in Larnaca. */
  grantFrom: studioWallTimeToInstant(2026, 10, 19, 0, 0),
  grantUntil: null,
  updatedAt: null,
  updatedBy: null,
};

export const WELCOME_LIMITS = {
  minCredits: 1,
  maxCredits: 5,
  minDays: 1,
  maxDays: 365,
} as const;

/** The server-level kill switch, for tests and emergencies. */
export function welcomeSwitchedOffByServer() {
  return process.env.PROMO_ENABLED === "false";
}

export function getWelcomeSettings(): WelcomeSettings {
  const row = db
    .select()
    .from(welcomeOffer)
    .where(eq(welcomeOffer.id, ROW_ID))
    .get();
  if (!row) return { ...WELCOME_DEFAULTS };
  return {
    enabled: row.enabled,
    credits: row.credits,
    validityDays: row.validityDays,
    grantFrom: row.grantFrom,
    grantUntil: row.grantUntil,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export type SaveWelcomeResult =
  | { ok: true; settings: WelcomeSettings }
  | { ok: false; code: "BAD_CREDITS" | "BAD_DAYS" | "BAD_DATES" };

export function saveWelcomeSettings(input: {
  enabled: boolean;
  credits: number;
  validityDays: number;
  grantFrom: Date;
  grantUntil: Date | null;
  staffName: string;
}): SaveWelcomeResult {
  const { enabled, credits, validityDays, grantFrom, grantUntil, staffName } =
    input;
  if (
    !Number.isInteger(credits) ||
    credits < WELCOME_LIMITS.minCredits ||
    credits > WELCOME_LIMITS.maxCredits
  ) {
    return { ok: false, code: "BAD_CREDITS" };
  }
  if (
    !Number.isInteger(validityDays) ||
    validityDays < WELCOME_LIMITS.minDays ||
    validityDays > WELCOME_LIMITS.maxDays
  ) {
    return { ok: false, code: "BAD_DAYS" };
  }
  if (
    Number.isNaN(grantFrom.getTime()) ||
    (grantUntil &&
      (Number.isNaN(grantUntil.getTime()) || grantUntil <= grantFrom))
  ) {
    return { ok: false, code: "BAD_DATES" };
  }

  const values = {
    enabled,
    credits,
    validityDays,
    grantFrom,
    grantUntil,
    updatedAt: new Date(),
    updatedBy: staffName,
  };
  db.insert(welcomeOffer)
    .values({ id: ROW_ID, ...values })
    .onConflictDoUpdate({ target: welcomeOffer.id, set: values })
    .run();
  return { ok: true, settings: getWelcomeSettings() };
}

/**
 * The offer an account created at `createdAt` qualifies for, by today's
 * settings. Null when it does not qualify or the offer is off.
 */
export function welcomeForJoin(
  createdAt: Date,
): { credits: number; validityDays: number } | null {
  if (welcomeSwitchedOffByServer()) return null;
  const s = getWelcomeSettings();
  if (!s.enabled) return null;
  if (createdAt < s.grantFrom) return null;
  if (s.grantUntil && createdAt > s.grantUntil) return null;
  return { credits: s.credits, validityDays: s.validityDays };
}

/**
 * At registration: write onto the account what the offer is right now.
 *
 * Never throws. A registration must not fail because of a free session.
 */
export function stampWelcome(user: { id: string; createdAt: Date }) {
  try {
    const offer = welcomeForJoin(user.createdAt);
    /* Zero is a stamp too: "registered while no offer applied". It stops a
       later switch-on from reaching back to somebody who signed up while it
       was off. Only accounts from before this existed are left null. */
    db.update(users)
      .set({
        welcomeCredits: offer?.credits ?? 0,
        welcomeDays: offer?.validityDays ?? 0,
      })
      .where(eq(users.id, user.id))
      .run();
  } catch (e) {
    console.error("[welcome] could not stamp", user.id, e);
  }
}

/**
 * At email confirmation: hand over the welcome session.
 *
 * What was stamped at registration wins, so a later change of settings or a
 * switch-off does not take it back. An account with no stamp — created before
 * this was deployed, or while the stamp could not be written — is judged by
 * its creation date against today's settings.
 *
 * Once per account: a second call finds the batch already there and does
 * nothing. Returns what was granted, or null.
 */
export function grantWelcome(
  user: { id: string; email: string; createdAt: Date },
  now = new Date(),
): { credits: number; expiresAt: Date } | null {
  if (welcomeSwitchedOffByServer()) return null;

  const already = db
    .select({ id: creditBatches.id })
    .from(creditBatches)
    .where(
      and(eq(creditBatches.userId, user.id), eq(creditBatches.offer, "WELCOME")),
    )
    .get();
  if (already) return null;

  const row = db
    .select({
      welcomeCredits: users.welcomeCredits,
      welcomeDays: users.welcomeDays,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .get();
  /* Stamped at registration: that is the promise, whatever the settings say
     now. Stamped zero: registered while no offer applied. Not stamped at all:
     an account from before this existed, judged by its creation date. */
  const stamped = row?.welcomeCredits ?? null;
  const offer =
    stamped === null
      ? welcomeForJoin(user.createdAt)
      : stamped > 0 && (row?.welcomeDays ?? 0) > 0
        ? { credits: stamped, validityDays: row!.welcomeDays! }
        : null;
  if (!offer) return null;

  /* N days from today, to the end of that day in Larnaca: the date the member
     is told is the whole of the last day. */
  const expiresAt = studioEndOfDay(studioAddDays(now, offer.validityDays));

  grantCredits({
    userId: user.id,
    credits: offer.credits,
    validityDays: null,
    expiresAt,
    source: "GRANT",
    reason: "WELCOME",
    kind: "CLASS",
    offer: "WELCOME",
    note: `Welcome session, valid until ${studioDateKey(expiresAt)}`,
  });

  return { credits: offer.credits, expiresAt };
}
