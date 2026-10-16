import { and, asc, desc, eq, gt, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  classSessions,
  classTypes,
  creditBatches,
  creditLedger,
  purchases,
} from "@/db/schema";
import type { CreditKind } from "./packs";
import { windowAllows } from "./promo";
import {
  studioAddDays,
  studioDateKey,
  studioEndOfDay,
  studioStartOfDay,
} from "./time";

/**
 * What a class needs paying with.
 *
 * A group class takes a CLASS session and nothing else. A midday appointment
 * takes a PERSONAL one, or a DUET one when a second person is coming. Neither
 * can be paid for with the other's, in either direction: a member holding five
 * class sessions and one personal has six sessions and exactly one of them can
 * book noon on Tuesday.
 */
export function kindsThatPayFor(
  classKind: "GROUP" | "PERSONAL",
  seats = 1,
): CreditKind[] {
  if (classKind === "GROUP") return ["CLASS"];
  /**
   * Three kinds, and each buys exactly one thing.
   *
   * A Duet session admits two people and is priced for two, so it cannot be
   * spent on an hour where only one turns up: that would be the studio charging
   * €45 for a €30 hour, and it would leave a second reformer set up for nobody.
   * A Personal session cannot cover two for the mirror-image reason.
   *
   * This was briefly forgiving in the other direction, with a solo booking
   * falling back to a Duet session when no Personal one was held. It read as a
   * kindness and it was a hole: a member with a Duet in their balance could book
   * the hour alone, and the studio would have sold the pair rate for one person.
   */
  return seats > 1 ? ["DUET"] : ["PERSONAL"];
}

export type CreditSummary = {
  available: number;
  /** Only the sessions that buy a place in a group class. */
  classCredits: number;
  /** Sessions that buy a midday appointment, personal or duet. */
  personalCredits: number;
  /** Of those, the ones that admit a second person. */
  duetCredits: number;
  /**
   * Of those, the ones for one person alone.
   *
   * Reported apart from `duetCredits` rather than left to be subtracted,
   * because the two are not interchangeable and the screens that offer a
   * choice need to know which of them the member actually holds.
   */
  soloCredits: number;
  batches: {
    id: string;
    creditsRemaining: number;
    creditsTotal: number;
    expiresAt: Date | null;
    source: string;
    kind: string;
    perDayLimit: number | null;
    /** Set when these sessions may only be spent on classes in a date range. */
    usableFrom: Date | null;
    usableTo: Date | null;
    /** "WELCOME" for the free session a new account gets; else null. */
    offer: string | null;
  }[];
  /** Soonest expiry among batches that still hold credits */
  nextExpiry: Date | null;
  nextExpiryCredits: number;
};

/** Batches that still hold credits and have not expired, soonest expiry first. */
export async function liveBatches(userId: string, now = new Date()) {
  return db
    .select()
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.creditsRemaining, 0),
        or(isNull(creditBatches.expiresAt), gt(creditBatches.expiresAt, now)),
      ),
    )
    .orderBy(asc(creditBatches.expiresAt), asc(creditBatches.createdAt));
}

export async function getCreditSummary(
  userId: string,
  now = new Date(),
): Promise<CreditSummary> {
  const batches = await liveBatches(userId, now);
  const available = batches.reduce((n, b) => n + b.creditsRemaining, 0);
  const withExpiry = batches.filter((b) => b.expiresAt);
  const nextExpiry = withExpiry[0]?.expiresAt ?? null;
  const nextExpiryCredits = nextExpiry
    ? batches
        .filter((b) => b.expiresAt?.getTime() === nextExpiry.getTime())
        .reduce((n, b) => n + b.creditsRemaining, 0)
    : 0;

  const sum = (kinds: string[]) =>
    batches
      .filter((b) => kinds.includes(b.kind))
      .reduce((n, b) => n + b.creditsRemaining, 0);

  return {
    available,
    /* Counted apart because they are not one balance. A member with five class
       sessions and one personal reading "6 sessions" and finding they cannot
       book two of the classes they were looking at is a site that lied to them
       in its own headline figure. */
    classCredits: sum(["CLASS"]),
    personalCredits: sum(["PERSONAL", "DUET"]),
    duetCredits: sum(["DUET"]),
    soloCredits: sum(["PERSONAL"]),
    batches: batches.map((b) => ({
      id: b.id,
      creditsRemaining: b.creditsRemaining,
      creditsTotal: b.creditsTotal,
      expiresAt: b.expiresAt,
      source: b.source,
      kind: b.kind,
      perDayLimit: b.perDayLimit,
      usableFrom: b.usableFrom,
      usableTo: b.usableTo,
      offer: b.offer,
    })),
    nextExpiry,
    nextExpiryCredits,
  };
}

/**
 * Does this member hold anything at all, window or no window?
 *
 * Used only to tell two failures apart: "you have no sessions" and "you have
 * sessions that cannot pay for *this* class". Those need different words on
 * screen, and a member with a visible balance of 1 being told they have none is
 * how a site loses somebody's trust in one sentence.
 */
export function spendableAnywhere(
  userId: string,
  now = new Date(),
  kinds?: CreditKind[],
) {
  return (
    db
      .select()
      .from(creditBatches)
      .where(
        and(
          eq(creditBatches.userId, userId),
          gt(creditBatches.creditsRemaining, 0),
          or(isNull(creditBatches.expiresAt), gt(creditBatches.expiresAt, now)),
        ),
      )
      .all()
      .filter((b) => !kinds || kinds.includes(b.kind as CreditKind)).length > 0
  );
}

export async function getAvailableCredits(userId: string, now = new Date()) {
  const rows = await liveBatches(userId, now);
  return rows.reduce((n, b) => n + b.creditsRemaining, 0);
}

/**
 * How many classes this member has already booked on a given studio day.
 *
 * Cancelled bookings do not count: somebody who booked 07:00, thought better of
 * it and cancelled in time has used nothing, and telling them they have had
 * their class for the day would be punishing them for changing their mind.
 *
 * Written as SQL against the studio's own calendar day rather than a range of
 * instants, because "one class a day" is a statement about days in Larnaca.
 */
export function bookingsOnStudioDay(
  userId: string,
  day: Date,
  /** A session to leave out, used when the member is re-booking one. */
  exceptSessionId?: string,
) {
  const key = studioDateKey(day);
  return db
    .select({ sessionId: bookings.sessionId, startsAt: classSessions.startsAt })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(and(eq(bookings.userId, userId), ne(bookings.status, "CANCELLED")))
    .all()
    .filter(
      (r) =>
        studioDateKey(r.startsAt) === key && r.sessionId !== exceptSessionId,
    ).length;
}

/**
 * Why a member holding sessions still cannot pay for this class.
 *
 * Worked out from the same three filters `spendOneCredit` applies, in the same
 * order, so the reason on screen is the reason the spend failed rather than a
 * guess made afterwards. Five outcomes and each needs its own sentence:
 *
 *   NONE        they hold nothing at all
 *   WRONG_KIND  they hold sessions, but not the kind this class takes
 *   WINDOW      the right kind, restricted to other dates (the opening week)
 *   PER_DAY     the right kind, but they have already trained today
 *   NOT_BLOCKED nothing here explains it, so the caller should not claim to
 */
export function spendBlockReason(
  userId: string,
  opts: { classStartsAt: Date; kinds?: CreditKind[]; sessionId?: string },
  now = new Date(),
): "NONE" | "WRONG_KIND" | "WINDOW" | "PER_DAY" | "NOT_BLOCKED" {
  const all = db
    .select()
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.creditsRemaining, 0),
        or(isNull(creditBatches.expiresAt), gt(creditBatches.expiresAt, now)),
      ),
    )
    .all();

  if (all.length === 0) return "NONE";

  const rightKind = opts.kinds
    ? all.filter((b) => opts.kinds!.includes(b.kind as CreditKind))
    : all;
  if (rightKind.length === 0) return "WRONG_KIND";

  const inWindow = rightKind.filter((b) => windowAllows(b, opts.classStartsAt));
  if (inWindow.length === 0) return "WINDOW";

  const already = bookingsOnStudioDay(
    userId,
    opts.classStartsAt,
    opts.sessionId,
  );
  const underCap = inWindow.filter(
    (b) => b.perDayLimit === null || already < b.perDayLimit,
  );
  if (underCap.length === 0) return "PER_DAY";

  return "NOT_BLOCKED";
}

/**
 * The last class date the member's own sessions can reach, of a given kind.
 *
 * Only batches with no `usableFrom`, which is what separates an ordinary pack
 * from the opening-week offer: a promo session is restricted to a week in the
 * middle of the calendar and needs a different sentence on screen than "your
 * sessions expire before then". Returns null when nothing applies, which the
 * caller reads as "do not claim a date you cannot name".
 */
export function lastClassDateFor(
  userId: string,
  kinds: CreditKind[],
  now = new Date(),
): Date | null {
  const rows = db
    .select()
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.creditsRemaining, 0),
        or(isNull(creditBatches.expiresAt), gt(creditBatches.expiresAt, now)),
      ),
    )
    .all()
    .filter(
      (b) =>
        kinds.includes(b.kind as CreditKind) &&
        /* A paid pack with a chosen start date is still an ordinary pack: its
           window runs to its own expiry. Only a gifted window (the opening
           week) is left out, because it needs its own sentence. */
        (b.usableFrom === null || b.source === "PURCHASE") &&
        b.usableTo !== null,
    );

  if (rows.length === 0) return null;
  return rows.reduce<Date>(
    (latest, b) => (b.usableTo! > latest ? b.usableTo! : latest),
    rows[0]!.usableTo!,
  );
}

/**
 * Spend one credit on one class.
 *
 * From the batch that expires soonest **among those allowed to pay for a class
 * on that date**. The second half is not a detail: a free opening-week session
 * carries a spend window, and without checking it here the member would book a
 * class in November, silently burn the free session, and then find they had
 * nothing left for the week the offer was for. Nobody would have seen an error;
 * they would simply have been robbed by a sort order.
 *
 * `classStartsAt` is optional so that callers with nothing to do with the
 * timetable — an adjustment at the desk, a test — keep working. Omitting it
 * means "any batch will do", which is the old behaviour.
 *
 * Returns the batch id it came from, or null if the member has nothing that can
 * pay for this class. Safe under concurrency: the UPDATE is conditional on
 * creditsRemaining > 0.
 */
export function spendOneCredit(
  userId: string,
  opts: {
    bookingId?: string;
    note?: string;
    classStartsAt?: Date;
    /**
     * Which kinds of session may pay for this class, best first. Omitted means
     * any, which is what a desk adjustment or a test wants.
     */
    kinds?: CreditKind[];
    /** The session being booked, so re-booking it does not count against a cap. */
    sessionId?: string;
  } = {},
  now = new Date(),
): string | null {
  const all = db
    .select()
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.creditsRemaining, 0),
        or(isNull(creditBatches.expiresAt), gt(creditBatches.expiresAt, now)),
      ),
    )
    .orderBy(asc(creditBatches.expiresAt), asc(creditBatches.createdAt))
    .all();

  let batches = opts.classStartsAt
    ? all.filter((b) => windowAllows(b, opts.classStartsAt!))
    : all;

  /**
   * The kind filter, and the order it imposes.
   *
   * `kinds` is a preference list, not a set: a solo appointment says
   * ["PERSONAL", "DUET"] because a personal session should be used up before a
   * duet one is spent on one person. Sorting by the position in that list and
   * then by expiry gives both rules in the right order of priority — spend the
   * right kind first, and within a kind spend what dies soonest.
   */
  if (opts.kinds) {
    const rank = new Map(opts.kinds.map((k, i) => [k as string, i]));
    batches = batches
      .filter((b) => rank.has(b.kind))
      .sort((a, b) => {
        const byKind = rank.get(a.kind)! - rank.get(b.kind)!;
        if (byKind !== 0) return byKind;
        const ax = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bx = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return ax - bx || a.createdAt.getTime() - b.createdAt.getTime();
      });
  }

  /**
   * The daily cap, checked only if a capped batch is in the running.
   *
   * An Unlimited plan grants one session for every day the studio opens in the
   * quarter, and this is the half of the plan that makes the word honest. The
   * count is taken once and only when it can matter, so an ordinary booking
   * pays nothing for a rule that does not apply to it.
   */
  if (opts.classStartsAt && batches.some((b) => b.perDayLimit !== null)) {
    const already = bookingsOnStudioDay(
      userId,
      opts.classStartsAt,
      opts.sessionId,
    );
    batches = batches.filter(
      (b) => b.perDayLimit === null || already < b.perDayLimit,
    );
  }

  for (const batch of batches) {
    const res = db
      .update(creditBatches)
      .set({ creditsRemaining: sql`${creditBatches.creditsRemaining} - 1` })
      .where(
        and(eq(creditBatches.id, batch.id), gt(creditBatches.creditsRemaining, 0)),
      )
      .run();

    if (res.changes > 0) {
      db.insert(creditLedger)
        .values({
          userId,
          delta: -1,
          reason: "BOOKING",
          note: opts.note,
          batchId: batch.id,
          bookingId: opts.bookingId,
        })
        .run();
      return batch.id;
    }
  }
  return null;
}

/** Return one credit to the batch it was taken from (used on free cancellation). */
export function refundOneCredit(
  userId: string,
  batchId: string | null,
  opts: {
    bookingId?: string;
    note?: string;
    /**
     * What to replace it with if the original batch has gone.
     *
     * Only reached in the fallback below, and it matters there: a cancelled
     * noon appointment refunded as an ordinary class session would quietly turn
     * €30 of one to one into €20 of group class, and the member would find out
     * the next time they tried to book noon.
     */
    kind?: CreditKind;
  } = {},
) {
  if (batchId) {
    const res = db
      .update(creditBatches)
      .set({
        creditsRemaining: sql`min(${creditBatches.creditsRemaining} + 1, ${creditBatches.creditsTotal})`,
      })
      .where(eq(creditBatches.id, batchId))
      .run();
    if (res.changes > 0) {
      db.insert(creditLedger)
        .values({
          userId,
          delta: 1,
          reason: "CANCELLATION_REFUND",
          note: opts.note,
          batchId,
          bookingId: opts.bookingId,
        })
        .run();
      return true;
    }
  }

  /**
   * No batch recorded, or the row has gone. Two steps, and neither of them may
   * hand back more than was taken.
   *
   * This fallback used to mint a fresh batch with **ninety days** on it, which is
   * a hole in two directions at once. A member whose session expired in a week
   * would have got three months back for cancelling, so booking and cancelling
   * became a way to reset an expiry; and a booking with no batch on it at all
   * would have produced a session out of nothing, which the member may never
   * have paid for.
   *
   * So the first move is to reconstruct where it came from. By the spending rule
   * a credit is always taken from the soonest-expiring batch, so the soonest
   * batch with room in it is the best available answer, and putting it there can
   * never extend an expiry. `creditsRemaining < creditsTotal` is what "with room"
   * means: a batch nothing was spent from cannot be the one this came from, and
   * topping it up past its own total would create a session.
   */
  const home = db
    .select()
    .from(creditBatches)
    .where(eq(creditBatches.userId, userId))
    .all()
    .filter(
      (b) =>
        b.creditsRemaining < b.creditsTotal &&
        (opts.kind ? b.kind === opts.kind : b.kind === "CLASS"),
    )
    .sort((a, b) => {
      const ax = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bx = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ax - bx || a.createdAt.getTime() - b.createdAt.getTime();
    })[0];

  if (home) {
    db.update(creditBatches)
      .set({ creditsRemaining: home.creditsRemaining + 1 })
      .where(eq(creditBatches.id, home.id))
      .run();
    db.insert(creditLedger)
      .values({
        userId,
        delta: 1,
        reason: "CANCELLATION_REFUND",
        note: opts.note
          ? `${opts.note} (batch not recorded, returned to the soonest one)`
          : "Batch not recorded, returned to the soonest one",
        batchId: home.id,
        bookingId: opts.bookingId,
      })
      .run();
    return true;
  }

  /**
   * Nothing to put it back into at all.
   *
   * Reached only when the member holds no batch that anything was ever spent
   * from, which means either the record is broken or every batch has been
   * cleared away. A cancellation that takes a session and returns nothing is
   * worse than a short compensation, so one is written, and it is deliberately
   * *short* rather than the ninety days this used to give: goodwill the studio
   * did not authorise is not the same thing as a refund. It is marked
   * COMPENSATION, which Analytics already keeps out of revenue and which shows
   * plainly in the member's own session history.
   */
  const until = studioEndOfDay(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  console.error(
    `[credits] refund for ${userId} had no batch to return to; wrote a 30-day compensation session`,
  );
  const batch = db
    .insert(creditBatches)
    .values({
      userId,
      creditsTotal: 1,
      creditsRemaining: 1,
      source: "COMPENSATION",
      expiresAt: until,
      usableTo: until,
      kind: opts.kind ?? "CLASS",
    })
    .returning()
    .get();

  db.insert(creditLedger)
    .values({
      userId,
      delta: 1,
      reason: "CANCELLATION_REFUND",
      note: opts.note ?? "Original credit batch unavailable",
      batchId: batch.id,
      bookingId: opts.bookingId,
    })
    .run();
  return true;
}

/** Grant credits: used by the Stripe webhook and by admin adjustments. */
export function grantCredits(args: {
  userId: string;
  credits: number;
  validityDays: number | null;
  source?: "PURCHASE" | "GRANT" | "COMPENSATION";
  purchaseId?: string;
  reason?: string;
  note?: string;
  /** An exact expiry, when it is a date rather than a number of days. */
  expiresAt?: Date | null;
  /**
   * Which class dates these sessions may be spent on. Both null — the normal
   * case — means any class. See lib/promo.ts for why this is separate from
   * expiry.
   */
  usableFrom?: Date | null;
  usableTo?: Date | null;
  /**
   * What these sessions buy. Defaults to CLASS, so every existing caller —
   * the webhook, the desk, the promo, the tests — keeps granting exactly what
   * it granted before.
   */
  kind?: CreditKind;
  /** The most classes a day they may pay for. Null means no cap. */
  perDayLimit?: number | null;
  /**
   * The day the member chose for this pack to start, "YYYY-MM-DD" in Larnaca.
   *
   * When given, it replaces the automatic queueing below: the member has said
   * when they want it, so the pack runs from that day for its validity, and
   * its sessions can only book classes from that day on. Today or earlier
   * means "from now", exactly as a pack without a start date. See `packWindow`.
   */
  startsOn?: string | null;
  /** Which offer this grant is ("WELCOME"); see lib/welcome.ts. */
  offer?: string | null;
}) {
  const {
    userId,
    credits,
    validityDays,
    source = "PURCHASE",
    purchaseId,
    reason = "PURCHASE",
    note,
  } = args;

  /**
   * Expiry lands at the end of the last day, not at the minute of purchase.
   *
   * It used to be `now + 30 × 24h` to the millisecond, which meant a pack bought
   * at 14:53 died at 14:53 on the thirtieth day. The member's account shows only
   * the date, so somebody who bought at nine in the morning and came back at
   * eight in the evening on their last day saw a date that was still today and a
   * balance that had already gone. Two people buying the same pack on the same
   * day had expiry times hours apart, for no reason either of them could see.
   *
   * Rounding up to 23:59:59.999 in Larnaca makes the date on screen exactly
   * true, and hands the member the rest of their last day. An explicit
   * `expiresAt` is left alone: the promo passes a real date and means it.
   */
  /**
   * A new pack starts the day after the current one ends, not the day it is
   * bought.
   *
   * The bug this fixes: validity used to count from the moment of purchase, even
   * when a pack was already running. A member on a 30-day, 4-session pack (one
   * class a week) who buys next month's pack a week early lost that week — the
   * second pack's clock started immediately and ran out while the first was
   * still being used, so its last sessions fell past its own expiry and could
   * not be booked. Three weeks of a four-week pack, wasted, every renewal.
   *
   * So when this is a PURCHASE with a validity and no explicit expiry, we look
   * at the member's own live paid packs of the *same kind* and, if one is still
   * running, count the new pack's days from the day after the latest one ends
   * rather than from today. The member can buy early and every session is
   * usable at once.
   *
   * The anchor is the latest expiry among their live paid packs, whatever is
   * left on them — a pack with every session already booked is still their
   * current pack until it ends. Only same-kind PURCHASE packs chain: class with
   * class, personal or duet with their own. A desk goodwill grant (GRANT) or a
   * promo never moves a pack and is never an anchor, and an expired pack is
   * ignored — so after a gap a new pack counts from today exactly as before.
   *
   * `Date.now()` is the one clock, so a test can move it.
   */
  const nowMs = Date.now();
  let chainAnchor: Date | null = null;
  let expiresAt: Date | null;
  /* Set only by a chosen start date in the future. */
  let startsFrom: Date | null = null;
  let chosenStart: string | null = null;
  let effectiveStart: string | null = null;
  let topUp = false;
  if (args.expiresAt !== undefined) {
    /* An explicit expiry is a date the caller means — the joining promo passes
       one. Never chained, never moved. */
    expiresAt = args.expiresAt;
  } else if (args.startsOn) {
    /* The member chose the day. No queueing behind a running pack: they have
       seen what they hold and picked a date, and second-guessing it here would
       hand them a window they did not ask for. */
    const kindNow = args.kind ?? "CLASS";
    /* A hard start only for somebody with nothing running. With a pack of the
       same kind still active, the new one is a top-up: its days count from the
       chosen day, but its sessions can be booked straight away, alongside the
       old ones — the studio's rule, and how queued packs always worked. */
    const running = hasRunningPack(userId, kindNow, new Date(nowMs));
    /* And a top-up is never counted from later than the day after the running
       pack ends. Its sessions are usable now whatever day was picked, so a later
       day would only be free days. Checked here, at the moment the sessions are
       granted, and not only when the day was chosen: the member may have bought
       another pack in between, on another tab. */
    let chosenDay = args.startsOn;
    if (running) {
      const cap = suggestedStart(userId, kindNow, new Date(nowMs)).startsOn;
      if (chosenDay > cap) chosenDay = cap;
    }
    const w = packWindow(chosenDay, validityDays, new Date(nowMs));
    expiresAt = w.expiresAt;
    startsFrom = running ? null : w.usableFrom;
    topUp = running;
    chosenStart = w.usableFrom ? w.startsOn : null;
    effectiveStart = w.startsOn;
  } else if (validityDays && validityDays > 0) {
    let anchorMs = nowMs;
    if (source === "PURCHASE") {
      /* Live paid packs of this same kind. The date test excludes an expired
         pack, and a NULL expiry fails it too, so only a genuinely running pack
         can move the anchor. `creditsRemaining` is deliberately not filtered. */
      const live = db
        .select({ e: creditBatches.expiresAt })
        .from(creditBatches)
        .where(
          and(
            eq(creditBatches.userId, userId),
            eq(creditBatches.source, "PURCHASE"),
            eq(creditBatches.kind, args.kind ?? "CLASS"),
            gt(creditBatches.expiresAt, new Date(nowMs)),
          ),
        )
        .all();
      for (const row of live) {
        if (row.e && row.e.getTime() > anchorMs) anchorMs = row.e.getTime();
      }
      if (anchorMs > nowMs) chainAnchor = new Date(anchorMs);
    }
    /* Rounded up to the end of the last day in Larnaca, exactly as an
       unchained pack is, so the date on the member's account is true to the
       minute and two members who bought together share an expiry. */
    expiresAt = studioEndOfDay(
      new Date(anchorMs + validityDays * 24 * 60 * 60 * 1000),
    );
  } else {
    expiresAt = null;
  }

  /**
   * And the class has to fall inside the window too, not just the booking.
   *
   * This was the bug underneath the bug. `expiresAt` governed when a session
   * could be *spent* and nothing governed what it could be spent *on*, so a
   * member could buy a 30-day pack, wait until day 29, and book classes across
   * November and December. Thirty days then constrained the shopping and not the
   * training: the pack became unlimited in horizon, and seats came out of a
   * timetable the studio had not started selling.
   *
   * The mechanism already existed for the opening-week offer, which is exactly
   * this question asked about a promotion. So an ordinary pack now carries the
   * same upper bound as its own expiry, and `usableFrom` stays null because
   * there is no lower one: a session bought today is good for a class tonight.
   *
   * A batch with no expiry keeps no window either, which is right. Nothing
   * limits a session that never dies.
   */
  const usableTo =
    args.usableTo !== undefined ? args.usableTo : expiresAt;

  const batch = db
    .insert(creditBatches)
    .values({
      userId,
      purchaseId,
      creditsTotal: credits,
      creditsRemaining: credits,
      source,
      expiresAt,
      usableFrom: args.usableFrom ?? startsFrom,
      usableTo,
      kind: args.kind ?? "CLASS",
      perDayLimit: args.perDayLimit ?? null,
      offer: args.offer ?? null,
    })
    .returning()
    .get();

  /* The purchase keeps the day the pack's days are actually counted from. It can
     differ from the day picked: a day that has passed by the time the payment
     lands becomes today, and a top-up is capped as above. The desk's "move
     start" moves from this day, so it has to be the true one. */
  if (purchaseId && effectiveStart) {
    db.update(purchases)
      .set({ startsOn: effectiveStart })
      .where(eq(purchases.id, purchaseId))
      .run();
  }

  /* When the pack was queued behind a running one, say so on the ledger line so
     the desk can see why the expiry is what it is rather than a month from
     today. */
  const finalNote =
    chainAnchor && expiresAt
      ? `${note ? `${note} — ` : ""}Starts after the current pack (${studioDateKey(
          chainAnchor,
        )}), sessions expire ${studioDateKey(expiresAt)}`
      : chosenStart
        ? `${note ? `${note} — ` : ""}${
            topUp ? `Days counted from ${chosenStart}, usable now` : `Starts ${chosenStart}`
          }${
            expiresAt ? `, sessions expire ${studioDateKey(expiresAt)}` : ""
          }`
        : note;

  db.insert(creditLedger)
    .values({
      userId,
      delta: credits,
      reason,
      note: finalNote,
      batchId: batch.id,
      purchaseId,
    })
    .run();

  /* A group pack bought by a member who still holds their welcome session:
     keep the welcome session for after the pack. See welcomeFollowsPack. */
  if (source === "PURCHASE" && (args.kind ?? "CLASS") === "CLASS") {
    /* In a savepoint of its own and never allowed to throw outward: this runs
       inside the payment's transaction, and a fault in a free-session nicety
       must never roll back a sale the member has paid for. If it fails, the
       welcome session simply stays as it was. */
    try {
      db.transaction(() => welcomeFollowsPack(userId, batch, new Date(nowMs)));
    } catch (e) {
      console.error("[welcome] could not keep the welcome session for", userId, e);
    }
  }

  return batch;
}

/** How many days after a pack ends the welcome session stays usable. */
export const WELCOME_FOLLOW_DAYS = 7;

/**
 * The welcome session follows the member's group pack.
 *
 * The problem it solves. Somebody joins on a Monday, is given one free session
 * for 30 days, and buys a 4-session monthly pack the same day. They now hold
 * five sessions, and both lots expire on the same day — so the fifth weekly
 * Thursday falls after both, and one session they own can never be booked.
 *
 * The fix, run the moment the pack is granted:
 *
 *   1. If the welcome session is already booked on a class that has not
 *      happened yet, that booking is moved onto the new pack (when the pack can
 *      pay for that class), and the welcome session goes back to the balance
 *      unused. The booking itself does not change: same class, same place.
 *   2. Whatever is left of the welcome session is then kept until
 *      WELCOME_FOLLOW_DAYS after the pack ends — never shortened.
 *
 * Spending always takes the session that expires soonest, so the pack is used
 * first and the welcome session covers the week after it. The total balance is
 * the same before and after; only which session pays for what changes. Every
 * move is written to the ledger.
 *
 * Group packs only, because the welcome session only buys group classes.
 */
export function welcomeFollowsPack(
  userId: string,
  pack: {
    id: string;
    source: string;
    kind: string;
    expiresAt: Date | null;
    usableFrom: Date | null;
    usableTo: Date | null;
    perDayLimit: number | null;
  },
  now = new Date(),
) {
  if (pack.source !== "PURCHASE" || pack.kind !== "CLASS" || !pack.expiresAt) {
    return;
  }

  const welcomes = db
    .select()
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, userId),
        eq(creditBatches.offer, "WELCOME"),
        eq(creditBatches.kind, "CLASS"),
        gt(creditBatches.expiresAt, now),
      ),
    )
    .all();
  if (welcomes.length === 0) return;

  const target = studioEndOfDay(
    studioAddDays(pack.expiresAt, WELCOME_FOLLOW_DAYS),
  );
  const until = studioDateKey(target);

  for (const w of welcomes) {
    /* The first group pack bought after the welcome session only, as agreed:
       otherwise every renewal would push the free session on again and a
       member who keeps renewing would never get to use it. */
    const earlier = db
      .select({ id: creditBatches.id })
      .from(creditBatches)
      .where(
        and(
          eq(creditBatches.userId, userId),
          eq(creditBatches.source, "PURCHASE"),
          eq(creditBatches.kind, "CLASS"),
          gte(creditBatches.createdAt, w.createdAt),
          ne(creditBatches.id, pack.id),
        ),
      )
      .get();
    if (earlier) continue;

    /* 1. Upcoming classes this welcome session paid for, earliest first. */
    const upcoming = db
      .select({
        id: bookings.id,
        sessionId: bookings.sessionId,
        startsAt: classSessions.startsAt,
      })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(
        and(
          eq(bookings.userId, userId),
          eq(bookings.creditBatchId, w.id),
          eq(bookings.status, "CONFIRMED"),
          gt(classSessions.startsAt, now),
        ),
      )
      .orderBy(asc(classSessions.startsAt))
      .all();

    for (const bk of upcoming) {
      /* The pack must be able to pay for this class: inside its dates, and
         within its daily cap if it has one. Otherwise the booking stays where
         it is — the pack starts later and covers the later weeks anyway. */
      if (!windowAllows(pack, bk.startsAt)) continue;
      if (
        pack.perDayLimit !== null &&
        bookingsOnStudioDay(userId, bk.startsAt, bk.sessionId) >=
          pack.perDayLimit
      ) {
        continue;
      }

      /* Three writes that must all happen or none: the welcome session gets
         its session back, the pack gives one, the booking points at the pack.
         Each is conditional, and a refusal undoes this booking's swap. */
      const swapped = (() => {
        try {
          return db.transaction(() => {
            const back = db
              .update(creditBatches)
              .set({ creditsRemaining: sql`${creditBatches.creditsRemaining} + 1` })
              .where(
                and(
                  eq(creditBatches.id, w.id),
                  lt(creditBatches.creditsRemaining, creditBatches.creditsTotal),
                ),
              )
              .run();
            const took = db
              .update(creditBatches)
              .set({ creditsRemaining: sql`${creditBatches.creditsRemaining} - 1` })
              .where(
                and(eq(creditBatches.id, pack.id), gt(creditBatches.creditsRemaining, 0)),
              )
              .run();
            const moved = db
              .update(bookings)
              .set({ creditBatchId: pack.id })
              .where(and(eq(bookings.id, bk.id), eq(bookings.creditBatchId, w.id)))
              .run();
            if (back.changes === 0 || took.changes === 0 || moved.changes === 0) {
              throw new Error("SWAP_REFUSED");
            }
            return true;
          });
        } catch {
          return false;
        }
      })();
      if (!swapped) continue;

      const day = studioDateKey(bk.startsAt);
      db.insert(creditLedger)
        .values({
          userId,
          delta: -1,
          reason: "BOOKING",
          note: `Booking on ${day} moved onto the new pack, welcome session kept for later`,
          batchId: pack.id,
          bookingId: bk.id,
        })
        .run();
      db.insert(creditLedger)
        .values({
          userId,
          delta: 1,
          reason: "WELCOME_KEPT",
          note: `Booking on ${day} now paid by the pack`,
          batchId: w.id,
          bookingId: bk.id,
        })
        .run();
    }

    /* 2. Keep what is left until a week after the pack. */
    const fresh = db
      .select()
      .from(creditBatches)
      .where(eq(creditBatches.id, w.id))
      .get();
    if (
      !fresh ||
      fresh.creditsRemaining <= 0 ||
      !fresh.expiresAt ||
      fresh.expiresAt.getTime() >= target.getTime()
    ) {
      continue;
    }
    db.update(creditBatches)
      .set({
        expiresAt: target,
        /* The welcome session has no narrower window of its own, so its class
           window follows its expiry, exactly as a pack's does. */
        ...(fresh.usableTo !== null && fresh.usableFrom === null
          ? { usableTo: target }
          : {}),
      })
      .where(eq(creditBatches.id, w.id))
      .run();
    db.insert(creditLedger)
      .values({
        userId,
        delta: 0,
        reason: "WELCOME_KEPT",
        note: `Welcome session ${studioDateKey(fresh.expiresAt)} to ${until}, ${WELCOME_FOLLOW_DAYS} days after the pack`,
        batchId: w.id,
      })
      .run();
  }
}

export async function getLedger(userId: string, limit = 40) {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit);
}

/* ------------------------------------------------ when a pack starts */

/**
 * How far ahead a member may start a pack, in days.
 *
 * A pack bought in October to start in March is a pack priced, and a timetable
 * promised, five months before anybody knows what either will be. Thirty days
 * covers "my current one runs out next month" with room to spare. The member's
 * own suggested start is always allowed even when it is further out than this
 * (somebody holding a quarterly pack that ends in seven weeks), so the limit
 * never refuses the date the site itself proposed.
 */
export const START_AHEAD_DAYS = 30;

/**
 * Does this member hold a paid pack of this kind that has not expired?
 *
 * Decides whether a chosen start day is a hard start (nothing running: the
 * sessions wait for that day) or only where the days are counted from (a pack
 * running: the new sessions top up the balance and can be booked now).
 * `exceptId` leaves one pack out, for the desk moving that pack's own start.
 */
export function hasRunningPack(
  userId: string,
  kind: CreditKind,
  now = new Date(),
  exceptId?: string,
) {
  return db
    .select({ id: creditBatches.id })
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, userId),
        eq(creditBatches.source, "PURCHASE"),
        eq(creditBatches.kind, kind),
        gt(creditBatches.expiresAt, now),
      ),
    )
    .all()
    .some((b) => b.id !== exceptId);
}

/** A day key as an instant safely inside that day in Larnaca (noon UTC). */
function dayKeyInstant(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

/** Is this a real calendar day written as "YYYY-MM-DD"? 2026-02-30 is not. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const at = dayKeyInstant(value);
  return !Number.isNaN(at.getTime()) && studioDateKey(at) === value;
}

/** A day key moved by whole calendar days in Larnaca. */
export function addDays(key: string, days: number) {
  return studioDateKey(studioAddDays(dayKeyInstant(key), days));
}

/**
 * The window a pack covers if it starts on `startsOn`.
 *
 * One rule for every start day, so the date on the checkout is the date on the
 * account: a pack of N days runs from its start day to the end of the day N
 * days later. Bought today, that is exactly what it always was (10 October,
 * thirty days, valid to 9 November). Started on the 15th, it runs to the end of
 * 14 November.
 *
 * A start today or earlier means "from now": no lower bound on the classes it
 * can book, which is the behaviour every pack had before members could choose.
 * A start in the future sets `usableFrom` to midnight on that day, which is the
 * same mechanism the opening-week offer used, so the booking rules already know
 * how to honour it.
 */
export function packWindow(
  startsOn: string,
  validityDays: number | null,
  now = new Date(),
) {
  const today = studioDateKey(now);
  const start = isDayKey(startsOn) && startsOn > today ? startsOn : today;
  const later = start > today;
  return {
    startsOn: start,
    usableFrom: later ? studioStartOfDay(dayKeyInstant(start)) : null,
    expiresAt:
      validityDays && validityDays > 0
        ? studioEndOfDay(dayKeyInstant(addDays(start, validityDays)))
        : null,
  };
}

export type StartSuggestion = {
  /** The day the site suggests, "YYYY-MM-DD". */
  startsOn: string;
  /**
   * Why that day, so the screen can say so in a sentence:
   *   TODAY               nothing running, start now
   *   AFTER_PACK          a pack is running with sessions left in it
   *   AFTER_LAST_BOOKING  every session is used or booked; start after the last
   */
  reason: "TODAY" | "AFTER_PACK" | "AFTER_LAST_BOOKING";
  /** What they hold now of this kind, for the overlap warning. */
  current: { sessionsLeft: number; endsOn: string } | null;
  /** The day of their last booked class, when that is what decided it. */
  lastBookedOn: string | null;
};

/**
 * The start day to suggest for a new pack of `kind`.
 *
 * The studio's rule, chosen so that buying early never wastes a day:
 *
 *   - nothing running: today;
 *   - a pack running with sessions still unused: the day after it ends, so the
 *     new days do not tick away while the old sessions are being used;
 *   - a pack running but every session already used or booked: the day after
 *     their last booked class, so there is no gap in which they cannot book.
 *
 * Only paid packs of the same kind count, exactly as for queueing: a class pack
 * does not move a personal one, and a goodwill session from the desk is not "a
 * pack". The member can always pick another day; this is only the default.
 */
export function suggestedStart(
  userId: string,
  kind: CreditKind = "CLASS",
  now = new Date(),
): StartSuggestion {
  const today = studioDateKey(now);

  const live = db
    .select()
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, userId),
        eq(creditBatches.source, "PURCHASE"),
        eq(creditBatches.kind, kind),
        gt(creditBatches.expiresAt, now),
      ),
    )
    .all();

  if (live.length === 0) {
    return { startsOn: today, reason: "TODAY", current: null, lastBookedOn: null };
  }

  /* A pack is running, so the new one is a top-up: its sessions can be booked
     straight away, and only the end matters. Its days are counted from the day
     after the running pack ends — the latest one, whatever is left in it — so
     buying early never shortens what the member gets. This is the queueing the
     studio always had (one day more generous: the new pack's days begin the day
     after, rather than the last second of, the old one). */
  const latest = live.reduce<Date>(
    (m, b) => (b.expiresAt! > m ? b.expiresAt! : m),
    live[0]!.expiresAt!,
  );
  const endsOn = studioDateKey(latest);
  const sessionsLeft = live.reduce((n, b) => n + b.creditsRemaining, 0);
  const after = addDays(endsOn, 1);
  return {
    startsOn: after > today ? after : today,
    reason: after > today ? "AFTER_PACK" : "TODAY",
    current: { sessionsLeft, endsOn },
    lastBookedOn: null,
  };
}

/** The days a member may choose from, and the one to preselect. */
export function startChoices(
  userId: string,
  kind: CreditKind = "CLASS",
  now = new Date(),
) {
  const today = studioDateKey(now);
  const suggestion = suggestedStart(userId, kind, now);
  const ahead = addDays(today, START_AHEAD_DAYS);
  return {
    ...suggestion,
    min: today,
    /* With a pack running, the new sessions are usable straight away, so the
       latest day its days may count from is the day after the running one
       ends. Anything later would be days for nothing. With nothing running,
       up to START_AHEAD_DAYS ahead. */
    max: suggestion.current
      ? suggestion.startsOn
      : suggestion.startsOn > ahead
        ? suggestion.startsOn
        : ahead,
  };
}

/** Is `startsOn` a day this member may choose for a pack of `kind`? */
export function startAllowed(
  userId: string,
  kind: CreditKind,
  startsOn: unknown,
  now = new Date(),
): startsOn is string {
  if (!isDayKey(startsOn)) return false;
  const { min, max } = startChoices(userId, kind, now);
  return startsOn >= min && startsOn <= max;
}

/**
 * When a member's sessions cannot book a class only because their pack has not
 * started yet: the first day one of them can, so the refusal can say "your pack
 * starts on 15 October" instead of something vaguer.
 */
export function startsLaterFor(
  userId: string,
  kinds: CreditKind[],
  classStartsAt: Date,
  now = new Date(),
): Date | null {
  const later = db
    .select()
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.creditsRemaining, 0),
        or(isNull(creditBatches.expiresAt), gt(creditBatches.expiresAt, now)),
      ),
    )
    .all()
    .filter(
      (b) =>
        kinds.includes(b.kind as CreditKind) &&
        /* Paid packs only. A gifted window (the opening-week offer) keeps its
           own refusal, which explains the offer and links to the prices. */
        b.source === "PURCHASE" &&
        b.usableFrom !== null &&
        b.usableFrom > classStartsAt,
    );
  if (later.length === 0) return null;
  return later.reduce<Date>(
    (m, b) => (b.usableFrom! < m ? b.usableFrom! : m),
    later[0]!.usableFrom!,
  );
}
