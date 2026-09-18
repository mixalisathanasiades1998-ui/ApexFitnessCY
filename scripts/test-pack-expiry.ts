/**
 * Pack expiry chains onto a running pack. Run with: npm run test:pack-expiry
 *
 * The bug this guards against: a pack's validity used to count from the moment
 * of purchase, even when the member already had a pack running. Somebody on a
 * 30-day, 4-session pack (one class a week) who bought next month's pack a week
 * early lost that week — the new pack's clock started immediately and expired
 * while the first pack was still being spent, so its last session fell past its
 * own expiry and could not be booked. Three weeks of a four-week pack, wasted,
 * every renewal.
 *
 * The fix, in `grantCredits`: when a PURCHASE with a validity and no explicit
 * expiry lands on a member who already holds a live paid pack of the same kind,
 * the new pack's days count from the day after the current one ends, not from
 * today. So the member can renew early and every session is usable at once.
 *
 * This suite replays the exact scenario against a real database with a stubbed
 * clock, and checks the three things that made the bug invisible in the first
 * place:
 *
 *   - the chained pack's expiry sits a full validity past the running pack's,
 *     not a validity past today;
 *   - a class on the far edge of the chained window is inside `usableTo`, so it
 *     can actually be booked the day it is paid for;
 *   - the rules that must NOT chain still don't: a different kind, a desk grant,
 *     and a pack bought after everything has expired all count from today.
 *
 * Fixtures are a throwaway `isTest` account, removed at the end, and the clock
 * is restored in a finally — safe to run against dev.db as often as you like.
 * Instants are fixed at noon UTC so a day boundary is never near a DST edge.
 */
import { and, eq } from "drizzle-orm";
import { db, sqlite } from "../src/db";
import { creditBatches, creditLedger, users } from "../src/db/schema";
import { grantCredits } from "../src/lib/credits";
import { studioDateKey } from "../src/lib/time";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`, extra ?? "");
  }
}

/** A fixed instant at noon UTC, safely clear of any day boundary. */
function noon(iso: string): number {
  return new Date(`${iso}T12:00:00.000Z`).getTime();
}

/** The stubbed clock. grantCredits reads Date.now(), so this is its only view
 *  of "now". */
const realNow = Date.now;
function at<T>(ms: number, fn: () => T): T {
  Date.now = () => ms;
  try {
    return fn();
  } finally {
    Date.now = realNow;
  }
}

/** The ledger note grantCredits wrote for a batch, if any. */
function ledgerNote(batchId: string): string | null {
  const row = db
    .select({ note: creditLedger.note })
    .from(creditLedger)
    .where(eq(creditLedger.batchId, batchId))
    .get();
  return row?.note ?? null;
}

async function main() {
  const user = db
    .insert(users)
    .values({
      email: `pack-expiry-${realNow()}@apex.test`,
      name: "Pack Expiry Fixture",
      phone: `+35799${String(Math.floor(Math.random() * 900000) + 100000)}`,
      passwordHash: "x",
      isTest: true,
      emailVerifiedAt: new Date(),
    })
    .returning()
    .get();
  const userId = user.id;

  const grant = (
    ms: number,
    opts: Parameters<typeof grantCredits>[0],
  ) => at(ms, () => grantCredits(opts));

  /* ---------------------------------------------------------------- 1 */
  console.log("\n1. First pack counts from the day it is bought");
  const p1 = grant(noon("2026-09-18"), {
    userId,
    credits: 4,
    validityDays: 30,
    kind: "CLASS",
    reason: "PURCHASE",
    note: "test month 1",
  });
  check(
    "a 30-day pack bought 18 Sep expires 18 Oct",
    studioDateKey(p1.expiresAt!) === "2026-10-18",
    studioDateKey(p1.expiresAt!),
  );
  check(
    "and the first pack carries no chaining note",
    !/Starts after the current pack/.test(ledgerNote(p1.id) ?? ""),
    ledgerNote(p1.id),
  );

  /* ---------------------------------------------------------------- 2 */
  console.log("\n2. A pack bought while one is running starts after it");
  const p2 = grant(noon("2026-10-08"), {
    userId,
    credits: 4,
    validityDays: 30,
    kind: "CLASS",
    reason: "PURCHASE",
    note: "test month 2",
  });
  check(
    "bought 8 Oct while the first runs, it expires 17 Nov, not 7 Nov",
    studioDateKey(p2.expiresAt!) === "2026-11-17",
    studioDateKey(p2.expiresAt!),
  );
  /* The whole point: a class on the last usable Tuesday, 10 Nov 16:00, is
     inside the window and can be booked the day the pack is paid for. Under the
     bug the pack died 7 Nov and this class was unreachable. */
  const lastTuesday = new Date("2026-11-10T16:00:00+02:00");
  check(
    "and a class on 10 Nov 16:00 is inside its usable window",
    Boolean(p2.usableTo) && p2.usableTo!.getTime() >= lastTuesday.getTime(),
    { usableTo: p2.usableTo, class: lastTuesday },
  );
  check(
    "and the ledger note explains the queued expiry to the desk",
    /Starts after the current pack \(2026-10-18\)/.test(ledgerNote(p2.id) ?? "") &&
      /sessions expire 2026-11-17/.test(ledgerNote(p2.id) ?? ""),
    ledgerNote(p2.id),
  );

  /* ---------------------------------------------------------------- 3 */
  console.log("\n3. Chaining follows the latest live pack, not the expired one");
  /* On 20 Oct the first pack (expired 18 Oct) is gone; the second (17 Nov) is
     the live one, so the third counts from the day after 17 Nov. */
  const p3 = grant(noon("2026-10-20"), {
    userId,
    credits: 4,
    validityDays: 30,
    kind: "CLASS",
    reason: "PURCHASE",
    note: "test month 3",
  });
  check(
    "bought 20 Oct, it chains onto the 17 Nov pack and expires 17 Dec",
    studioDateKey(p3.expiresAt!) === "2026-12-17",
    studioDateKey(p3.expiresAt!),
  );

  /* ---------------------------------------------------------------- 4 */
  console.log("\n4. Only the same kind chains; grants never do");
  /* A personal session bought the same day: no live personal pack exists, so it
     counts from today even though class packs are running. */
  const personal = grant(noon("2026-10-20"), {
    userId,
    credits: 1,
    validityDays: 30,
    kind: "PERSONAL",
    reason: "PURCHASE",
    note: "test personal",
  });
  check(
    "a personal session bought 20 Oct counts from today, expiring 19 Nov",
    studioDateKey(personal.expiresAt!) === "2026-11-19",
    studioDateKey(personal.expiresAt!),
  );
  check(
    "and it does not chain onto the class packs",
    !/Starts after the current pack/.test(ledgerNote(personal.id) ?? ""),
    ledgerNote(personal.id),
  );

  /* A desk goodwill grant bought the same day: a class pack is live, but a GRANT
     is never chained and never an anchor, so it counts from today. */
  const deskGrant = grant(noon("2026-10-20"), {
    userId,
    credits: 1,
    validityDays: 30,
    kind: "CLASS",
    source: "GRANT",
    reason: "GRANT",
    note: "test desk grant",
  });
  check(
    "a desk grant bought 20 Oct counts from today, expiring 19 Nov",
    studioDateKey(deskGrant.expiresAt!) === "2026-11-19",
    studioDateKey(deskGrant.expiresAt!),
  );
  check(
    "and the desk grant carries no chaining note",
    !/Starts after the current pack/.test(ledgerNote(deskGrant.id) ?? ""),
    ledgerNote(deskGrant.id),
  );
  /* The grant must not have moved the anchor for anything else either: it was
     never eligible to be one. Nothing to assert beyond its own expiry, which
     already proves it counted from today rather than 17 Dec. */

  /* ---------------------------------------------------------------- 5 */
  console.log("\n5. After a gap, a new pack counts from today again");
  /* By 1 Jan 2027 every pack above (latest expiry 17 Dec) has expired, so there
     is nothing live to chain onto and the pack counts from purchase day. */
  const p4 = grant(noon("2027-01-01"), {
    userId,
    credits: 4,
    validityDays: 30,
    kind: "CLASS",
    reason: "PURCHASE",
    note: "test month 4",
  });
  check(
    "bought 1 Jan after everything expired, it expires 31 Jan",
    studioDateKey(p4.expiresAt!) === "2027-01-31",
    studioDateKey(p4.expiresAt!),
  );
  check(
    "and it carries no chaining note",
    !/Starts after the current pack/.test(ledgerNote(p4.id) ?? ""),
    ledgerNote(p4.id),
  );

  /* --------------------------------------------------------- sanity check */
  /* The clock is back to the real one the moment each grant returns. */
  check(
    "the clock is restored after the scenario",
    Date.now === realNow,
  );

  /* -------------------------------------------------------------- tidy up */
  sqlite.prepare("delete from credit_ledger where user_id = ?").run(userId);
  sqlite.prepare("delete from credit_batches where user_id = ?").run(userId);
  sqlite.prepare("delete from users where id = ?").run(userId);
  const left = db
    .select({ id: creditBatches.id })
    .from(creditBatches)
    .where(and(eq(creditBatches.userId, userId)))
    .all().length;
  check("fixtures cleaned up", left === 0, left);

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  Date.now = realNow;
  console.error(e);
  process.exit(1);
});
