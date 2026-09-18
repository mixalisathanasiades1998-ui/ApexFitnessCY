/**
 * The desk extending a pack's expiry. Run with: npm run test:extend-expiry
 *
 * The feature: an instructor or the owner can push a member's pack expiry out —
 * for a member who was away or ill, or as goodwill — without granting sessions
 * the member does not need. The rules that keep it safe are the ones worth
 * pinning down, because each one fails quietly if it breaks:
 *
 *   - extend only: a date on or before the current expiry is refused, so nobody
 *     shortens paid validity with a mistyped date;
 *   - the class-usability window moves with the expiry on a normal pack, so the
 *     extra days are days the member can actually book — but a promo pack's
 *     narrower window is left alone, so an extension never hands out dates the
 *     offer excluded;
 *   - no sessions are added or removed: the balance is identical afterwards, and
 *     the change is a zero-delta audit line on the ledger;
 *   - a two-year ceiling catches a year typo.
 *
 * Fixtures are a throwaway isTest account, removed at the end.
 */
import { eq } from "drizzle-orm";
import { db, sqlite } from "../src/db";
import { creditBatches, creditLedger, users } from "../src/db/schema";
import { grantCredits, getCreditSummary } from "../src/lib/credits";
import { extendExpiry } from "../src/lib/reception";
import { studioDateKey, studioEndOfDay } from "../src/lib/time";

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

const DAY = 24 * 60 * 60 * 1000;
const batchById = (id: string) =>
  db.select().from(creditBatches).where(eq(creditBatches.id, id)).get();

async function main() {
  const user = db
    .insert(users)
    .values({
      email: `extend-${Date.now()}@apex.test`,
      name: "Extend Fixture",
      phone: `+35799${String(Math.floor(Math.random() * 900000) + 100000)}`,
      passwordHash: "x",
      isTest: true,
      emailVerifiedAt: new Date(),
    })
    .returning()
    .get();
  const userId = user.id;
  const staff = { staffId: "staff-test", staffName: "Tester" };

  /* ---------------------------------------------------------------- 1 */
  console.log("\n1. Extending one pack moves its expiry and its window");
  const b1 = grantCredits({
    userId,
    credits: 4,
    validityDays: 30,
    kind: "CLASS",
    reason: "PURCHASE",
  });
  const before = (await getCreditSummary(userId)).available;
  const oldExpiry = b1.expiresAt!;
  const wasUsableTo = b1.usableTo!;
  check(
    "a normal pack starts with its window equal to its expiry",
    wasUsableTo.getTime() === oldExpiry.getTime(),
    { usableTo: wasUsableTo, expiresAt: oldExpiry },
  );

  const target1 = new Date(oldExpiry.getTime() + 40 * DAY);
  const r1 = await extendExpiry({ userId, batchId: b1.id, newExpiry: target1, ...staff });
  check("the extend succeeds", r1.ok === true, r1);
  const after1 = batchById(b1.id)!;
  check(
    "the expiry moves to the chosen day",
    studioDateKey(after1.expiresAt!) === studioDateKey(studioEndOfDay(target1)),
    studioDateKey(after1.expiresAt!),
  );
  check(
    "and the usable window moves with it",
    after1.usableTo!.getTime() === after1.expiresAt!.getTime(),
    { usableTo: after1.usableTo, expiresAt: after1.expiresAt },
  );
  check(
    "the balance is untouched",
    (await getCreditSummary(userId)).available === before,
    (await getCreditSummary(userId)).available,
  );
  const audit = db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.batchId, b1.id))
    .all()
    .find((l) => l.reason === "ADMIN_EXTEND");
  check("a zero-delta audit line is written", Boolean(audit) && audit!.delta === 0, audit);
  check(
    "and it names the new date and the staff member",
    /Tester/.test(audit?.note ?? "") &&
      new RegExp(studioDateKey(after1.expiresAt!)).test(audit?.note ?? ""),
    audit?.note,
  );

  /* ---------------------------------------------------------------- 2 */
  console.log("\n2. It refuses to shorten a pack");
  const earlier = new Date(after1.expiresAt!.getTime() - 5 * DAY);
  const r2 = await extendExpiry({ userId, batchId: b1.id, newExpiry: earlier, ...staff });
  check(
    "a date on or before the current expiry is refused",
    r2.ok === false && r2.code === "NOT_LATER",
    r2,
  );
  check(
    "and the pack's expiry is left exactly where it was",
    batchById(b1.id)!.expiresAt!.getTime() === after1.expiresAt!.getTime(),
    batchById(b1.id)!.expiresAt,
  );

  /* ---------------------------------------------------------------- 3 */
  console.log("\n3. A promo window is not widened by an extension");
  /* A pack whose window is narrower than its expiry is a promotional one. */
  const promoUsableTo = new Date(Date.now() + 10 * DAY);
  const b3 = grantCredits({
    userId,
    credits: 1,
    validityDays: 30,
    kind: "CLASS",
    reason: "PURCHASE",
    usableTo: promoUsableTo,
  });
  check(
    "the promo pack starts with a window narrower than its expiry",
    b3.usableTo!.getTime() < b3.expiresAt!.getTime(),
    { usableTo: b3.usableTo, expiresAt: b3.expiresAt },
  );
  const r3 = await extendExpiry({
    userId,
    batchId: b3.id,
    newExpiry: new Date(b3.expiresAt!.getTime() + 20 * DAY),
    ...staff,
  });
  check("the extend succeeds", r3.ok === true, r3);
  const after3 = batchById(b3.id)!;
  check(
    "its expiry moves",
    after3.expiresAt!.getTime() > b3.expiresAt!.getTime(),
    after3.expiresAt,
  );
  check(
    "but the promo window stays exactly where it was",
    after3.usableTo!.getTime() === promoUsableTo.getTime() ||
      studioDateKey(after3.usableTo!) === studioDateKey(promoUsableTo),
    { usableTo: after3.usableTo, promo: promoUsableTo },
  );

  /* ---------------------------------------------------------------- 4 */
  console.log("\n4. Extend all moves every live pack, and only forward");
  /* b1 now expires ~40 days past its original; b3 ~20 days past a 30-day pack.
     A date past both lifts both. */
  const far = studioDateKey(
    studioEndOfDay(new Date(Date.now() + 200 * DAY)),
  );
  const rAll = await extendExpiry({
    userId,
    all: true,
    newExpiry: new Date(`${far}T00:00:00`),
    ...staff,
  });
  check("extend-all succeeds", rAll.ok === true, rAll);
  check(
    "it reports both live packs moved",
    rAll.ok === true && rAll.extended === 2,
    rAll,
  );
  check(
    "both packs now share the far date",
    studioDateKey(batchById(b1.id)!.expiresAt!) === far &&
      studioDateKey(batchById(b3.id)!.expiresAt!) === far,
    {
      b1: studioDateKey(batchById(b1.id)!.expiresAt!),
      b3: studioDateKey(batchById(b3.id)!.expiresAt!),
    },
  );
  /* Run it again at the same date: nothing is later than itself, so nothing
     moves and the desk is told rather than shown a silent success. */
  const rAgain = await extendExpiry({
    userId,
    all: true,
    newExpiry: new Date(`${far}T00:00:00`),
    ...staff,
  });
  check(
    "extending to the same date again moves nothing",
    rAgain.ok === false && rAgain.code === "NOT_LATER",
    rAgain,
  );

  /* ---------------------------------------------------------------- 5 */
  console.log("\n5. Guards: too far, nothing to extend");
  const rFar = await extendExpiry({
    userId,
    batchId: b1.id,
    newExpiry: new Date(Date.now() + 3 * 365 * DAY),
    ...staff,
  });
  check(
    "a date more than two years ahead is refused",
    rFar.ok === false && rFar.code === "TOO_FAR",
    rFar,
  );
  const rNone = await extendExpiry({
    userId,
    batchId: "does-not-exist",
    newExpiry: new Date(Date.now() + 100 * DAY),
    ...staff,
  });
  check(
    "an unknown pack id extends nothing",
    rNone.ok === false && rNone.code === "NOTHING_TO_EXTEND",
    rNone,
  );

  /* -------------------------------------------------------------- tidy up */
  sqlite.prepare("delete from credit_ledger where user_id = ?").run(userId);
  sqlite.prepare("delete from credit_batches where user_id = ?").run(userId);
  sqlite.prepare("delete from users where id = ?").run(userId);
  const left = db
    .select({ id: creditBatches.id })
    .from(creditBatches)
    .where(eq(creditBatches.userId, userId))
    .all().length;
  check("fixtures cleaned up", left === 0, left);

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
