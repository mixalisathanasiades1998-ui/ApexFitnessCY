/**
 * End-to-end check of the credit + booking rules against a real database.
 * Run with:  npx tsx scripts/test-flows.ts
 *
 * It creates a throwaway user, so it is safe to run against dev.db.
 */
import Database from "better-sqlite3";
import { and, eq, getTableColumns, gt, ne, sql } from "drizzle-orm";
import { ensureSchema } from "../src/db/migrate";
import { db, sqlite } from "../src/db";
import {
  bookings,
  classSessions,
  classTypes,
  creditBatches,
  creditLedger,
  users,
} from "../src/db/schema";
import { bookClass, cancelBooking } from "../src/lib/booking";
import { getAvailableCredits, grantCredits } from "../src/lib/credits";
import { hashPassword } from "../src/lib/auth";
import { STUDIO } from "../src/lib/studio";
import { getInstructors, getPackages } from "../src/lib/catalogue";
import { repairCatalogue } from "../src/lib/catalogue-repair";
import { OFFERED_PACK_SLUGS } from "../src/lib/packs";
import { repairSchedule } from "../src/lib/schedule-repair";
import {
  studioDayKeys,
  studioDayOfWeek,
  studioStartOfDay,
} from "../src/lib/time";
import {
  BOOKING_CUTOFF_MINUTES,
  FREE_CANCELLATION_HOURS,
} from "../src/lib/utils";
import { dictionaries } from "../src/i18n/dictionaries";

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

async function main() {
  const email = `test-${Date.now()}@apex.test`;
  const user = db
    .insert(users)
    .values({
      email,
      name: "Test Runner",
      passwordHash: await hashPassword("x".repeat(10)),
    })
    .returning()
    .get();

  console.log("\n1. Credits");
  check("new member has 0 credits", (await getAvailableCredits(user.id)) === 0);

  grantCredits({
    userId: user.id,
    credits: 10,
    validityDays: 90,
    source: "PURCHASE",
    note: "test pack",
  });
  check(
    "10-credit pack lands in wallet",
    (await getAvailableCredits(user.id)) === 10,
  );

  /* Expired batch must not count (written directly, with its ledger row) */
  const expiredBatch = db
    .insert(creditBatches)
    .values({
      userId: user.id,
      creditsTotal: 5,
      creditsRemaining: 5,
      source: "PURCHASE",
      expiresAt: new Date(Date.now() - 86_400_000),
    })
    .returning()
    .get();
  db.insert(creditLedger)
    .values({
      userId: user.id,
      delta: 5,
      reason: "PURCHASE",
      note: "test expired pack",
      batchId: expiredBatch.id,
    })
    .run();
  check(
    "expired credits are excluded from the balance",
    (await getAvailableCredits(user.id)) === 10,
  );

  console.log("\n2. Booking");
  /* Group classes only. The timetable now also carries midday appointments,
     which hold one person, close to booking at the end of the previous day and
     are paid for with a session an ordinary pack does not contain. Picking one
     of those here would fail three checks for reasons this suite is not
     about. */
  /* With room left in them, which is not the same as existing.
   *
   * This suite books several classes per run and every class holds five, so
   * taking the first four by date meant reaching for the same ones every time:
   * after a few runs against one database they were full, `bookClass` refused,
   * and the assertion that a credit came out of the soonest-expiring batch
   * failed because no credit had been spent at all. That reads as a broken
   * spending rule rather than a suite that has eaten its own fixtures. */
  const future = db
    .select({ s: classSessions })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(
      and(
        gt(classSessions.startsAt, new Date(Date.now() + 3 * 86_400_000)),
        eq(classTypes.kind, "GROUP"),
      ),
    )
    .all()
    .map((r) => r.s)
    .filter(
      (s) =>
        (
          sqlite
            .prepare(
              "select count(*) as n from bookings where session_id = ? and status != 'CANCELLED'",
            )
            .get(s.id) as { n: number }
        ).n < s.capacity,
    )
    .slice(0, 4);
  check("seeded future sessions exist", future.length >= 3, future.length);

  const s1 = future[0]!;
  const r1 = bookClass(user.id, s1.id);
  check("booking succeeds", r1.ok === true, r1);
  check("one credit deducted", (await getAvailableCredits(user.id)) === 9);

  const r2 = bookClass(user.id, s1.id);
  check(
    "double booking the same class is refused",
    r2.ok === false && r2.code === "ALREADY_BOOKED",
    r2,
  );
  check(
    "no extra credit taken on refusal",
    (await getAvailableCredits(user.id)) === 9,
  );

  console.log("\n3. Booking spends the soonest-expiring credit first");
  grantCredits({
    userId: user.id,
    credits: 2,
    validityDays: 7,
    note: "short pack",
  });
  const before = db
    .select()
    .from(creditBatches)
    .where(
      and(
        eq(creditBatches.userId, user.id),
        gt(creditBatches.creditsRemaining, 0),
      ),
    )
    .all()
    .sort(
      (a, b) => (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0),
    );
  const soonest = before.find(
    (b) => (b.expiresAt?.getTime() ?? 0) > Date.now(),
  )!;
  bookClass(user.id, future[1]!.id);
  const after = db
    .select()
    .from(creditBatches)
    .where(eq(creditBatches.id, soonest.id))
    .get()!;
  check(
    "credit taken from the batch expiring soonest",
    after.creditsRemaining === soonest.creditsRemaining - 1,
    { before: soonest.creditsRemaining, after: after.creditsRemaining },
  );

  console.log("\n4. Cancellation");
  const balBefore = await getAvailableCredits(user.id);
  const myBooking = db
    .select()
    .from(bookings)
    .where(and(eq(bookings.userId, user.id), eq(bookings.sessionId, s1.id)))
    .get()!;
  const c1 = cancelBooking(user.id, myBooking.id);
  check(
    "cancel far ahead is refunded",
    c1.ok === true && c1.refunded === true,
    c1,
  );
  check(
    "credit returned to wallet",
    (await getAvailableCredits(user.id)) === balBefore + 1,
  );
  const c2 = cancelBooking(user.id, myBooking.id);
  check(
    "cancelling twice is refused",
    c2.ok === false && c2.code === "ALREADY_CANCELLED",
    c2,
  );

  const fixtureSessionIds: string[] = [];

  console.log(
    `\n5. Cancellation closes ${FREE_CANCELLATION_HOURS} hours before the class`,
  );
  /* Both fixtures are derived from the constant rather than written as
     numbers. The window moved from 24 hours to 12 and these still read "24",
     which is how a suite ends up documenting a rule the app no longer has. */
  const insideHours = FREE_CANCELLATION_HOURS / 2;
  const outsideHours = FREE_CANCELLATION_HOURS + 1;
  /* A group class type, for the same reason: a session created under the
     appointment type would obey the appointment cutoff. */
  const ct = db
    .select()
    .from(classTypes)
    .where(eq(classTypes.kind, "GROUP"))
    .limit(1)
    .get()!;
  const soon = new Date(Date.now() + insideHours * 3600_000);
  const lateSession = db
    .insert(classSessions)
    .values({
      classTypeId: ct.id,
      startsAt: soon,
      endsAt: new Date(soon.getTime() + STUDIO.classLengthMinutes * 60_000),
      capacity: STUDIO.capacity,
    })
    .returning()
    .get();
  fixtureSessionIds.push(lateSession.id);
  const rl = bookClass(user.id, lateSession.id);
  check(`can book a class ${insideHours}h away`, rl.ok === true, rl);
  const balBeforeLate = await getAvailableCredits(user.id);
  const lateBooking = db
    .select()
    .from(bookings)
    .where(
      and(eq(bookings.userId, user.id), eq(bookings.sessionId, lateSession.id)),
    )
    .get()!;
  const c3 = cancelBooking(user.id, lateBooking.id);
  check(
    `cancelling inside ${FREE_CANCELLATION_HOURS} hours is refused`,
    c3.ok === false && c3.code === "TOO_LATE_TO_CANCEL",
    c3,
  );
  check(
    "balance untouched by the refused cancel",
    (await getAvailableCredits(user.id)) === balBeforeLate,
  );

  /* And one just outside it is still cancellable, session returned. */
  const ahead = new Date(Date.now() + outsideHours * 3600_000);
  const okSession = db
    .insert(classSessions)
    .values({
      classTypeId: ct.id,
      startsAt: ahead,
      endsAt: new Date(ahead.getTime() + STUDIO.classLengthMinutes * 60_000),
      capacity: STUDIO.capacity,
    })
    .returning()
    .get();
  fixtureSessionIds.push(okSession.id);
  check(
    `can book a class ${outsideHours}h away`,
    bookClass(user.id, okSession.id).ok === true,
  );
  const balMid = await getAvailableCredits(user.id);
  const okBooking = db
    .select()
    .from(bookings)
    .where(
      and(eq(bookings.userId, user.id), eq(bookings.sessionId, okSession.id)),
    )
    .get()!;
  const c4 = cancelBooking(user.id, okBooking.id);
  check(
    `cancelling outside ${FREE_CANCELLATION_HOURS} hours is refunded`,
    c4.ok === true && c4.refunded === true,
    c4,
  );
  check(
    "the session came back to the balance",
    (await getAvailableCredits(user.id)) === balMid + 1,
  );

  /* The published copy has to state the same number the rules enforce. */
  check(
    `copy quotes the ${FREE_CANCELLATION_HOURS}-hour window`,
    dictionaries.en.timetablePage.body.includes(
      `${FREE_CANCELLATION_HOURS} hours`,
    ) &&
      dictionaries.el.timetablePage.body.includes(
        `${FREE_CANCELLATION_HOURS} ώρες`,
      ),
  );

  console.log(
    `\n6. Booking cut-off (${BOOKING_CUTOFF_MINUTES} min before the start)`,
  );
  /* Derived from the constant, both sides of it. Written as "5 minutes away"
     these assertions described a thirty-minute cut-off and would have passed a
     one-minute one for the wrong reason — the studio's rule is now that the
     only reasons you cannot book are a closed day or a full class. */
  const mkSession = (msAway: number) => {
    const at = new Date(Date.now() + msAway);
    const row = db
      .insert(classSessions)
      .values({
        classTypeId: ct.id,
        startsAt: at,
        endsAt: new Date(at.getTime() + STUDIO.classLengthMinutes * 60_000),
        capacity: STUDIO.capacity,
      })
      .returning()
      .get();
    fixtureSessionIds.push(row.id);
    return row;
  };

  const insideCutoff = mkSession(BOOKING_CUTOFF_MINUTES * 60_000 * 0.5);
  const rt = bookClass(user.id, insideCutoff.id);
  check(
    `a class inside the ${BOOKING_CUTOFF_MINUTES}-minute cut-off is refused`,
    rt.ok === false && rt.code === "TOO_LATE",
    rt,
  );

  /* And the part that matters to a member standing at the door: a class about
     to start is still bookable right up to the cut-off. */
  const justOutside = mkSession((BOOKING_CUTOFF_MINUTES + 1) * 60_000);
  const rj = bookClass(user.id, justOutside.id);
  check(
    `a class ${BOOKING_CUTOFF_MINUTES + 1} minutes away still books`,
    rj.ok === true,
    rj,
  );
  cancelBooking(
    user.id,
    db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, user.id),
          eq(bookings.sessionId, justOutside.id),
        ),
      )
      .get()!.id,
  );

  console.log("\n7. Capacity");
  const capSession = db
    .insert(classSessions)
    .values({
      classTypeId: ct.id,
      startsAt: new Date(Date.now() + 5 * 86_400_000),
      endsAt: new Date(Date.now() + 5 * 86_400_000 + 50 * 60_000),
      capacity: 2,
    })
    .returning()
    .get();
  fixtureSessionIds.push(capSession.id);
  const fillers = [];
  for (let i = 0; i < 3; i++) {
    const u = db
      .insert(users)
      .values({
        email: `filler-${Date.now()}-${i}@apex.test`,
        name: `Filler ${i}`,
        passwordHash: "x",
      })
      .returning()
      .get();
    grantCredits({ userId: u.id, credits: 1, validityDays: 30 });
    fillers.push(u);
  }
  const results = fillers.map((u) => bookClass(u.id, capSession.id));
  check(
    "capacity 2 accepts exactly 2 bookings",
    results.filter((r) => r.ok).length === 2,
    results,
  );
  check(
    "the third is told the class is full",
    results.some((r) => !r.ok && r.code === "CLASS_FULL"),
    results,
  );
  check(
    "no credit taken from the rejected member",
    (await getAvailableCredits(fillers[2]!.id)) === 1 ||
      (await getAvailableCredits(
        fillers.find((_, i) => !results[i]!.ok)!.id,
      )) === 1,
  );

  console.log("\n8. No credits");
  const broke = db
    .insert(users)
    .values({
      email: `broke-${Date.now()}@apex.test`,
      name: "No Credits",
      passwordHash: "x",
    })
    .returning()
    .get();
  const rb = bookClass(broke.id, future[2]!.id);
  check(
    "member with no credits cannot book",
    rb.ok === false && rb.code === "NO_CREDITS",
    rb,
  );

  console.log("\n8b. The room the studio actually has");
  {
    /* Plant a class on the old rota and prove a read repairs it. This is the
       bug that kept showing 06:00 to 06:50 with eight places. */
    const future = new Date(Date.now() + 4 * 86_400_000);
    const stale = db
      .insert(classSessions)
      .values({
        classTypeId: ct.id,
        startsAt: future,
        endsAt: new Date(future.getTime() + 50 * 60_000),
        capacity: 8,
      })
      .returning()
      .get();
    fixtureSessionIds.push(stale.id);

    const fixed = repairSchedule();
    check("repair touched the stale class", fixed >= 1, fixed);

    const after = db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, stale.id))
      .get()!;
    check(
      `class is ${STUDIO.classLengthMinutes} minutes long`,
      (after.endsAt.getTime() - after.startsAt.getTime()) / 60_000 ===
        STUDIO.classLengthMinutes,
      (after.endsAt.getTime() - after.startsAt.getTime()) / 60_000,
    );
    check(
      `class has ${STUDIO.capacity} places`,
      after.capacity === STUDIO.capacity,
      after.capacity,
    );

    /* A class earlier today must be repaired too: the timetable window starts
       at midnight, so a leftover from this morning is still on the page. */
    const earlier = studioStartOfDay(new Date());
    const thisMorning = db
      .insert(classSessions)
      .values({
        classTypeId: ct.id,
        startsAt: earlier,
        endsAt: new Date(earlier.getTime() + 50 * 60_000),
        capacity: 8,
      })
      .returning()
      .get();
    fixtureSessionIds.push(thisMorning.id);
    repairSchedule();
    const fixedToday = db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, thisMorning.id))
      .get()!;
    check(
      "a class earlier today is repaired as well",
      fixedToday.capacity === STUDIO.capacity &&
        (fixedToday.endsAt.getTime() - fixedToday.startsAt.getTime()) /
          60_000 ===
          STUDIO.classLengthMinutes,
    );

    /* Capacity is never pulled below the people already in the room. */
    const held = db
      .insert(classSessions)
      .values({
        classTypeId: ct.id,
        startsAt: new Date(Date.now() + 6 * 86_400_000),
        endsAt: new Date(Date.now() + 6 * 86_400_000 + 50 * 60_000),
        capacity: 8,
      })
      .returning()
      .get();
    fixtureSessionIds.push(held.id);
    for (const u of fillers.slice(0, 3)) {
      db.insert(bookings)
        .values({ userId: u.id, sessionId: held.id, status: "CONFIRMED" })
        .run();
    }
    repairSchedule();
    const heldAfter = db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, held.id))
      .get()!;
    check(
      "capacity is not dropped below the people already booked",
      heldAfter.capacity >= 3,
      heldAfter.capacity,
    );
  }

  console.log("\n8c. Sundays never appear in the date picker");
  {
    const keys = studioDayKeys(studioStartOfDay(new Date()), 28, [0]);
    const sundays = keys.filter(
      (k) => studioDayOfWeek(new Date(`${k}T12:00:00Z`)) === 0,
    );
    check("no Sunday in a 28-day window", sundays.length === 0, sundays);
    check("the window still spans four weeks", keys.length === 24, keys.length);
  }

  /* The fixtures above insert real classes into the timetable. Clean them up so
     running the tests does not leave odd one-off times on the live schedule. */
  for (const id of fixtureSessionIds) {
    sqlite.prepare("delete from bookings where session_id = ?").run(id);
    sqlite.prepare("delete from class_sessions where id = ?").run(id);
  }
  console.log(`  · removed ${fixtureSessionIds.length} fixture classes`);

  console.log("\n8d. The catalogue heals itself without a re-seed");
  {
    /* This is the bug the studio hit twice: the change was in the seed script,
       the seed script had not been run, and the page kept showing the old
       catalogue. A read has to be enough.

       The withdrawn pack is created here rather than assumed. It used to come
       from an older seed, which meant this test quietly passed on databases old
       enough to contain it and failed on a freshly seeded one — a test that
       depends on leftover data is testing the leftovers. */
    sqlite
      .prepare(
        `insert into credit_packages
           (id, slug, name_en, name_el, credits, price_cents, validity_days, active, sort_order)
         values (?, 'intro-3', '3-class intro', 'Εισαγωγικό 3', 3, 4500, 60, 1, 99)
         on conflict(slug) do update set active = 1`,
      )
      .run(crypto.randomUUID());
    sqlite.prepare("update instructors set photo_url = NULL").run();

    const sync = repairCatalogue();
    check(
      "a withdrawn pack is taken off sale by a read",
      sync.withdrawn >= 1,
      sync,
    );
    /* And the other half of the job: the read path writes the current price
       list in, so changing packs.ts is the whole change. Without this a price
       change withdrew the old packs on boot and left nothing in their place
       until somebody remembered to reseed. */
    const second = repairCatalogue();
    check(
      "running it again changes nothing",
      second.added === 0 && second.updated === 0 && second.withdrawn === 0,
      second,
    );
    const listed = (await getPackages()).map((p) => p.slug).sort();
    check(
      "every pack on the price list is on sale",
      [...OFFERED_PACK_SLUGS].sort().every((sl) => listed.includes(sl)),
      { listed, expected: [...OFFERED_PACK_SLUGS].sort() },
    );

    const onSale = (await getPackages()).map((p) => p.slug);
    check(
      "the 3-class pack is not on sale",
      !onSale.includes("intro-3"),
      onSale,
    );
    check(
      "packs on sale match the offered list",
      onSale.every((slug) => OFFERED_PACK_SLUGS.has(slug)),
      onSale,
    );

    /* The row survives, because purchases point at it. */
    const stillThere = sqlite
      .prepare("select active from credit_packages where slug = 'intro-3'")
      .get() as { active: number } | undefined;
    check("the withdrawn pack row is kept, not deleted", Boolean(stillThere));

    const team = await getInstructors();
    check(
      "every instructor has a portrait with no photo_url in the database",
      team.length > 0 && team.every((m) => Boolean(m.photoUrl)),
      team.map((m) => `${m.name}:${m.photoUrl}`),
    );
  }

  console.log("\n8e. An older database is brought up to date on connect");
  {
    /* The crash that prompted this: a machine set up before the profile
       columns existed loaded the homepage and got
       `no such column: service_opt_in_at`. Opening the database has to be
       enough to fix that, because "remember to run db:push" plainly is not. */
    const probe = new Database(":memory:");
    probe.exec(`
      create table users (
        id text primary key not null,
        email text not null,
        name text not null,
        phone text,
        password_hash text not null,
        role text default 'MEMBER' not null,
        created_at integer not null
      );
      create table bookings (id text primary key not null);
      create table instructors (id text primary key not null, name text not null);
    `);

    const applied = ensureSchema(probe);
    check(
      "the migration reports what it added",
      applied.length > 0,
      applied.length,
    );

    const cols = new Set(
      (
        probe.prepare("pragma table_info(users)").all() as { name: string }[]
      ).map((c) => c.name),
    );
    for (const col of [
      "service_opt_in_at",
      "marketing_opt_in",
      "notify_email",
      "notify_sms",
      "notify_push",
      "reminder_minutes",
      "birth_date",
      "height_cm",
      "weight_grams",
    ]) {
      check(`users.${col} exists after migrating`, cols.has(col));
    }

    const tables = new Set(
      (
        probe
          .prepare("select name from sqlite_master where type='table'")
          .all() as { name: string }[]
      ).map((t) => t.name),
    );
    check("user_avatars exists", tables.has("user_avatars"));
    check("booking_reminders exists", tables.has("booking_reminders"));

    /* Running it twice must be a no-op, since it runs on every boot. */
    check("running it again changes nothing", ensureSchema(probe).length === 0);
    probe.close();
  }

  /* Every column in the schema must be known to the migration, or the next
     one added will crash an existing install exactly as this one did. */
  {
    const declared = new Set(Object.keys(getTableColumns(users)).map((k) => k));
    const sqlNames = new Set(
      Object.values(getTableColumns(users)).map((c) => c.name),
    );
    const live = new Set(
      (
        sqlite.prepare("pragma table_info(users)").all() as { name: string }[]
      ).map((c) => c.name),
    );
    const missing = [...sqlNames].filter((n) => !live.has(n));
    check(
      `every users column in the schema exists in the database (${declared.size} fields)`,
      missing.length === 0,
      missing,
    );
  }

  console.log("\n8f. Which language a phone notification goes out in");
  /**
   * The one-language channels, and the bug they had.
   *
   * Push and SMS carry a single language, and for a long time that language was
   * English for everybody — while the in-app copy of the same message sat in the
   * member's account in Greek, because that one stores both. A member reading the
   * site in Greek therefore got the studio speaking two languages about one
   * booking, which is worse than either alone.
   *
   * A cookie could never have fixed it: a reminder for a class in two hours is
   * composed by a sweep with no browser anywhere near it. So the choice is a
   * column on the account, and `say` is what reads it.
   */
  {
    const W = await import("../src/lib/messaging/wording");
    const { say } = W;
    const words = W.bookedWords({
      classEn: "Reformer Flow",
      classEl: "Ροή Reformer",
      startsAt: new Date(),
    });

    check(
      "a Greek member's notification is the Greek text",
      say(words, "el").subject === words.el.subject,
    );
    check(
      "an English member's is the English text",
      say(words, "en").subject === words.en.subject,
    );
    /**
     * The three ways of not having chosen, all of which mean English: a member
     * who has never touched the switch, a row from before the column existed,
     * and anything somebody typed by hand. English is the safe direction —
     * it is the language the studio itself is administered in.
     */
    check(
      "and never having chosen means English, not an empty message",
      say(words, null).subject === words.en.subject &&
        say(words, undefined).subject === words.en.subject &&
        say(words, "de").subject === words.en.subject,
    );

    /* The column itself, round-tripped, because the plumbing above is worth
       nothing if the choice is not written down. */
    db.update(users).set({ locale: "el" }).where(eq(users.id, user.id)).run();
    const saved = db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, user.id))
      .get();
    check("the account remembers the language", saved?.locale === "el", saved);
    db.update(users).set({ locale: null }).where(eq(users.id, user.id)).run();
  }

  console.log("\n8g. The receipt, which Stripe mails and this email does not");
  /**
   * A receipt for a card payment, and who sends it.
   *
   * The studio's own confirmation carries the sessions, the price and the expiry
   * date, and deliberately no receipt link. Two reasons, both learned rather
   * than guessed: a raw payment-processor URL inside the studio's own email is
   * exactly the shape of a phishing message, and Stripe's receipt links expire
   * after thirty days — so the email somebody keeps for their accountant holds
   * a dead link a month later.
   *
   * Stripe mails its own receipt to the same address, which the code supplies
   * as `receipt_email` from the member's account. This asserts the confirmation
   * stays clean, in both languages, whether or not a link happens to be on the
   * purchase row.
   */
  {
    const W = await import("../src/lib/messaging/wording");
    const args = {
      credits: 5,
      amountCents: 9000,
      currency: "eur",
      expiresAt: null,
    };

    const withUrl = W.purchasedWords({
      ...args,
      receiptUrl: "https://pay.stripe.com/receipts/abc123",
    });
    check(
      "the confirmation never puts a processor URL in front of a member",
      !withUrl.en.body.includes("pay.stripe.com") &&
        !withUrl.el.body.includes("pay.stripe.com"),
      withUrl.en.body,
    );
    check(
      "and does not promise a receipt it is not carrying",
      !/receipt/i.test(withUrl.en.body) && !/απόδειξ/i.test(withUrl.el.body),
      withUrl.en.body,
    );

    /* Same message with nothing on the row — a cash sale at the desk — so the
       two cases cannot drift apart. */
    const cash = W.purchasedWords(args);
    check(
      "a payment with no receipt reads identically",
      cash.en.body === withUrl.en.body && cash.el.body === withUrl.el.body,
    );
    check(
      "and both still say what was bought and for how much",
      cash.en.body.includes("5 sessions") && cash.en.body.includes("€90"),
      cash.en.body,
    );
  }

  console.log("\n8h. The VAT invoice");
  /**
   * The studio's own invoice, which is the document a Stripe receipt is not.
   *
   * A Stripe receipt names an amount and a card. It carries no VAT number and
   * no net-and-VAT breakdown, so it is not something a Cyprus accountant can
   * put through a set of books — which is the whole reason this exists.
   *
   * Three things are worth asserting and none of them are about layout. The
   * arithmetic has to balance to the cent. The specimen guard has to hold,
   * because the cost of it failing is a false tax document with the studio's
   * name on it. And the numbering has to be gapless and idempotent, because a
   * webhook and a returning browser both report the same payment.
   */
  {
    const V = await import("../src/lib/invoice");

    /* --- the arithmetic, on prices that are quoted VAT-inclusive --- */
    const at19 = V.vatSplit(2000, 19);
    check(
      "net plus VAT equals exactly what was paid",
      at19.netCents + at19.vatCents === 2000,
      at19,
    );
    check(
      "EUR 20 at 19% is 16.81 net and 3.19 VAT",
      at19.netCents === 1681 && at19.vatCents === 319,
      at19,
    );
    /**
     * The rounding case, which is the one that goes wrong.
     *
     * Rounding the net and the VAT independently is the obvious implementation
     * and produces invoices whose two lines do not add up to the total somebody
     * paid — the single error on a tax document that nobody will accept. So the
     * VAT is whatever is left after the net, and this checks it across a range
     * rather than at one convenient number.
     */
    let balanced = true;
    for (let cents = 1; cents <= 5000; cents++) {
      const s2 = V.vatSplit(cents, 19);
      if (s2.netCents + s2.vatCents !== cents) balanced = false;
    }
    check("and it balances for every amount up to EUR 50", balanced);

    const exempt = V.vatSplit(2000, 0);
    check(
      "a zero rate charges no VAT and claims none",
      exempt.netCents === 2000 && exempt.vatCents === 0,
      exempt,
    );

    /* --- the specimen guard --- */
    const before = {
      name: process.env.INVOICE_LEGAL_NAME,
      vat: process.env.INVOICE_VAT_NUMBER,
      rate: process.env.INVOICE_VAT_RATE,
    };

    delete process.env.INVOICE_LEGAL_NAME;
    check(
      "an unconfigured studio issues specimens, not invoices",
      V.invoiceIssuer().real === false,
      V.invoiceIssuer().why,
    );

    process.env.INVOICE_LEGAL_NAME = "Apex Test Ltd";
    process.env.INVOICE_ADDRESS = "Somewhere, Larnaca";
    process.env.INVOICE_VAT_NUMBER = "CY12345678X";
    process.env.INVOICE_VAT_RATE = "19";
    check(
      "and so does one whose details still say TEST",
      V.invoiceIssuer().real === false,
      V.invoiceIssuer().why,
    );

    process.env.INVOICE_LEGAL_NAME = "Apex Wellness Ltd";
    process.env.INVOICE_VAT_NUMBER = "NOTAVATNUMBER";
    check(
      "a VAT number of the wrong shape is refused",
      V.invoiceIssuer().real === false,
      V.invoiceIssuer().why,
    );

    process.env.INVOICE_VAT_NUMBER = "CY10456789J";
    const good = V.invoiceIssuer();
    check(
      "a complete, well-formed configuration is accepted",
      good.real === true && good.vatRatePercent === 19,
      good,
    );

    /* Put the environment back, so nothing after this runs configured. */
    if (before.name === undefined) delete process.env.INVOICE_LEGAL_NAME;
    else process.env.INVOICE_LEGAL_NAME = before.name;
    if (before.vat === undefined) delete process.env.INVOICE_VAT_NUMBER;
    else process.env.INVOICE_VAT_NUMBER = before.vat;
    if (before.rate === undefined) delete process.env.INVOICE_VAT_RATE;
    else process.env.INVOICE_VAT_RATE = before.rate;

    check(
      "SPECIMEN counts as no invoice number",
      V.isSpecimen(null) && V.isSpecimen("SPECIMEN") && !V.isSpecimen("2026-0001"),
    );
    check(
      "numbers are the year and four padded digits",
      V.formatInvoiceNo(2026, 7, "") === "2026-0007",
      V.formatInvoiceNo(2026, 7, ""),
    );
  }

  console.log("\n8i. An email that carries a file");
  /**
   * The MIME structure, which is the part of attaching a PDF that goes wrong.
   *
   * The studio's SMTP transport builds its own messages rather than using a
   * library, so the nesting is ours to get right. MIME cannot say "two
   * alternatives and also a PDF" in one part: the text-and-HTML pair has to
   * become the first child of a multipart/mixed, with the files as siblings.
   * Get it wrong and you produce the email everyone has received at some point
   * — a body that is a wall of base64, or an attachment rendered inline as
   * gibberish. Neither throws, which is exactly why it is worth a test.
   */
  {
    const { buildMessage } = await import("../src/lib/messaging/smtp");
    const pdf = Buffer.from("%PDF-1.3 pretend");

    const plain = buildMessage({
      from: "APEX pilates <hello@apexpilates.cy>",
      to: "member@example.com",
      msg: { subject: "Payment received", body: "Five sessions." },
      html: "<p>Five sessions.</p>",
    });
    check(
      "with nothing attached it stays a simple alternative pair",
      plain.includes("Content-Type: multipart/alternative") &&
        !plain.includes("multipart/mixed"),
    );

    const withFile = buildMessage({
      from: "APEX pilates <hello@apexpilates.cy>",
      to: "member@example.com",
      msg: {
        subject: "Payment received",
        body: "Five sessions.",
        attachments: [
          {
            filename: "APEX-pilates-invoice-2026-0001.pdf",
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      },
      html: "<p>Five sessions.</p>",
    });

    check(
      "with a file it becomes mixed, wrapping the alternative pair",
      withFile.includes("Content-Type: multipart/mixed") &&
        withFile.includes("Content-Type: multipart/alternative"),
    );
    check(
      "the alternative pair is closed before the file starts",
      withFile.indexOf("--apex_alt_") <
        withFile.indexOf("Content-Type: application/pdf"),
    );
    check(
      "the file is an attachment and not rendered inline",
      /Content-Disposition: attachment; filename="APEX-pilates-invoice-2026-0001\.pdf"/.test(
        withFile,
      ),
    );
    check(
      "and it survives the trip as base64",
      withFile.includes(pdf.toString("base64")),
    );
    /* Every boundary opened has to be closed, or a reader shows the rest of the
       message as part of the attachment. */
    const mixed = withFile.match(/boundary="(apex_mix_[a-f0-9]+)"/)?.[1];
    check(
      "and the outer boundary is properly closed",
      Boolean(mixed) && withFile.trimEnd().endsWith(`--${mixed}--`),
      mixed,
    );
  }

  console.log("\n8j. The studio's own copy of a payment");
  /**
   * Money arriving, told to the studio as well as to the member.
   *
   * Three tills feed this and two of them used to be silent: a card payment on
   * the website appeared only in the Stripe dashboard, and cash at the counter
   * appeared only in the drawer. The owner could not answer "what came in
   * today, and from whom" without opening two systems and asking whoever was on
   * shift.
   *
   * Asserted by capturing what the log transport writes, which is the only
   * honest way to test this: the wiring is `notifyPurchased` firing a second
   * email at a different address, and every part of that can break without any
   * test that only reads the database noticing.
   */
  {
    const W = await import("../src/lib/messaging/wording");
    const { notifyPurchased } = await import("../src/lib/messaging/events");
    const { STUDIO_OPS_EMAIL } = await import("../src/lib/personal");
    const { purchases } = await import("../src/db/schema");

    /* --- the words, first, because they are what somebody reads --- */
    const words = W.studioPaidWords({
      memberName: "Maria Georgiou",
      memberEmail: "maria@example.com",
      memberPhone: "+357 99 123456",
      methodEn: "Cash at the studio",
      methodEl: "Μετρητά στο στούντιο",
      credits: 10,
      amountCents: 18000,
      currency: "eur",
      balance: 12,
      staffName: "Elena",
      invoiceNo: "2026-0042",
      reference: null,
    });

    check(
      "the subject carries the amount and the name, so the mailbox reads without opening",
      words.en.subject.includes("€180") &&
        words.en.subject.includes("Maria Georgiou"),
      words.en.subject,
    );
    check(
      "the body says who paid and how to reach them",
      words.en.body.includes("maria@example.com") &&
        words.en.body.includes("+357 99 123456"),
      words.en.body,
    );
    check(
      "which till took it, and who was serving",
      words.en.body.includes("Cash at the studio") &&
        words.en.body.includes("Elena"),
      words.en.body,
    );
    check(
      "and the balance the member is now looking at",
      words.en.body.includes("Balance now: 12 sessions"),
      words.en.body,
    );
    check(
      "the Greek copy says the same things",
      words.el.body.includes("Μετρητά στο στούντιο") &&
        words.el.body.includes("Υπόλοιπο τώρα: 12 συνεδρίες"),
      words.el.body,
    );
    /* A desk reference is `desk:` plus a fragment of a staff id, which tells a
       reader nothing that "served by" has not already said. */
    check(
      "and nothing pretends to be a payment reference when there is none",
      !/Reference:/.test(words.en.body),
      words.en.body,
    );

    /* --- the wiring: does a real sale actually send it --- */
    const sale = db
      .insert(purchases)
      .values({
        userId: user.id,
        credits: 4,
        amountCents: 8000,
        currency: "eur",
        status: "PAID",
        provider: "cash",
        paidAt: new Date(),
        providerRef: "desk:testtest",
      })
      .returning()
      .get();

    const seen: string[] = [];
    const realLog = console.log;
    console.log = (...args: unknown[]) => {
      seen.push(args.map(String).join(" "));
    };
    try {
      await notifyPurchased(sale.id, { staffName: "Elena" });
      /* The studio's copy is fired and not awaited, on purpose: the member's
         confirmation must not wait for it. So give it a tick to land. */
      await new Promise((r) => setTimeout(r, 80));
    } finally {
      console.log = realLog;
    }

    const toStudio = seen.filter((l) => l.includes(STUDIO_OPS_EMAIL));
    check(
      "a cash sale at the desk emails the studio",
      toStudio.length === 1,
      { lines: seen.length, toStudio },
    );
    check(
      "and names the amount in the subject",
      toStudio.some((l) => l.includes("€80")),
      toStudio,
    );
    check(
      "the member is still told as well, and separately",
      seen.some(
        (l) => l.includes("Payment received") && !l.includes(STUDIO_OPS_EMAIL),
      ),
      seen.filter((l) => l.includes("email:log")),
    );

    db.delete(purchases).where(eq(purchases.id, sale.id)).run();
  }

  console.log("\n8k. Booking one slot for a whole term");
  /**
   * "Book my Monday ten o'clock for the next eight weeks."
   *
   * The studio sells three-month packs and members train on a fixed slot, so a
   * term of Mondays used to be twelve separate visits to the timetable. The
   * interesting properties are not that it books things — a loop does that —
   * but that it books the *right* things and tells the truth about the rest.
   */
  {
    const { repeatWeekly, MAX_REPEAT_WEEKS } = await import(
      "../src/lib/booking-repeat"
    );
    const { studioDayOfWeek, studioParts } = await import("../src/lib/time");

    /* A member of their own, so nothing here disturbs the balances the rest of
       this suite has been counting. */
    const termUser = db
      .insert(users)
      .values({
        email: `term-${Date.now()}@apex.test`,
        name: "Term Booker",
        passwordHash: await hashPassword("x".repeat(10)),
      })
      .returning()
      .get();
    grantCredits({
      userId: termUser.id,
      credits: 20,
      validityDays: 200,
      note: "term pack",
    });

    /* A group class far enough ahead that six more of the same slot exist. */
    const seed = db
      .select({ s: classSessions })
      .from(classSessions)
      .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
      .where(
        and(
          gt(classSessions.startsAt, new Date(Date.now() + 2 * 86_400_000)),
          eq(classTypes.kind, "GROUP"),
        ),
      )
      .orderBy(classSessions.startsAt)
      .all()
      .map((r) => r.s)[0]!;

    const run = repeatWeekly({
      userId: termUser.id,
      sessionId: seed.id,
      weeks: 6,
    });

    check("a term booking succeeds", run.ok === true, run);
    if (run.ok) {
      check(
        "it books more than one week",
        run.booked >= 2,
        { booked: run.booked, failed: run.failed.length },
      );
      check(
        "and never more weeks than were asked for",
        run.outcomes.length <= 6,
        run.outcomes.length,
      );

      /**
       * The same weekday and the same minute, every time.
       *
       * This is the assertion that matters, and the reason the implementation
       * matches on the studio's own weekday and minute-of-day rather than adding
       * seven days repeatedly. Cyprus changes its clocks in late October, so a
       * naive "+7 days" from September lands an hour out for the back half of a
       * twelve-week booking and quietly moves somebody's 10:00 to 09:00.
       */
      const wd = studioDayOfWeek(seed.startsAt);
      const p0 = studioParts(seed.startsAt);
      const sameSlot = run.outcomes.every((o) => {
        const d = new Date(o.startsAt);
        const p = studioParts(d);
        return (
          studioDayOfWeek(d) === wd &&
          p.hour === p0.hour &&
          p.minute === p0.minute
        );
      });
      check(
        "every week is the same weekday and the same clock time",
        sameSlot,
        run.outcomes.map((o) => o.startsAt),
      );

      /* Each one really is booked, not merely reported. */
      const held = run.bookingIds.length;
      const rows = db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(eq(bookings.userId, termUser.id), ne(bookings.status, "CANCELLED")),
        )
        .all().length;
      check(
        "the bookings are actually on the books",
        rows === held && held === run.booked,
        { rows, held, booked: run.booked },
      );

      /* One credit per class, and not one per press. */
      check(
        "one session was spent per week booked",
        (await getAvailableCredits(termUser.id)) === 20 - run.booked,
        {
          left: await getAvailableCredits(termUser.id),
          booked: run.booked,
        },
      );

      /**
       * Asking twice is not a way to book the same class twice.
       *
       * A member who presses it again — impatience, a double tap, a refresh —
       * must not end up with two places in one class. Every week comes back as
       * "you already had this", which is deliberately counted apart from a
       * failure: they asked for their Monday slot and they have their Monday
       * slot, and reporting that as an error would be a refusal nobody needs to
       * act on.
       */
      const again = repeatWeekly({
        userId: termUser.id,
        sessionId: seed.id,
        weeks: 6,
      });
      check(
        "pressing it again books nothing new",
        again.ok === true && again.booked === 0,
        again,
      );
      check(
        "and says the weeks were already theirs rather than calling it a failure",
        again.ok === true &&
          again.alreadyHad === run.booked &&
          again.failed.length === 0,
        again,
      );
      check(
        "no second session was spent",
        (await getAvailableCredits(termUser.id)) === 20 - run.booked,
      );
    }

    /* --- what it refuses --- */
    const one = repeatWeekly({
      userId: termUser.id,
      sessionId: seed.id,
      weeks: 1,
    });
    check(
      "one week is not a repeat, and is refused",
      one.ok === false && one.code === "BAD_WEEKS",
      one,
    );
    const tooMany = repeatWeekly({
      userId: termUser.id,
      sessionId: seed.id,
      weeks: MAX_REPEAT_WEEKS + 1,
    });
    check(
      "and neither is a year of them",
      tooMany.ok === false && tooMany.code === "BAD_WEEKS",
      tooMany,
    );

    /**
     * An appointment cannot be repeated, and that is a studio decision.
     *
     * Every Personal or Duet hour commits somebody to come in and teach it,
     * arranged by hand the day before. Twelve booked in one press is twelve
     * instructor hours the studio has promised without anybody at the desk
     * seeing it happen.
     */
    const appointment = db
      .select({ s: classSessions })
      .from(classSessions)
      .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
      .where(
        and(
          gt(classSessions.startsAt, new Date(Date.now() + 2 * 86_400_000)),
          eq(classTypes.kind, "PERSONAL"),
        ),
      )
      .all()
      .map((r) => r.s)[0];

    if (appointment) {
      const refused = repeatWeekly({
        userId: termUser.id,
        sessionId: appointment.id,
        weeks: 4,
      });
      check(
        "a Personal hour is not repeatable from the timetable",
        refused.ok === false && refused.code === "NOT_REPEATABLE",
        refused,
      );
    }

    /* Tidy up, so a repeat run starts clean. */
    db.delete(bookings).where(eq(bookings.userId, termUser.id)).run();
    db.delete(creditLedger).where(eq(creditLedger.userId, termUser.id)).run();
    db.delete(creditBatches).where(eq(creditBatches.userId, termUser.id)).run();
    db.delete(users).where(eq(users.id, termUser.id)).run();
  }

  console.log("\n9. Ledger integrity");
  const ledgerSum =
    db
      .select({ n: sql<number>`coalesce(sum(delta),0)` })
      .from(creditLedger)
      .where(eq(creditLedger.userId, user.id))
      .get()?.n ?? 0;
  const batchSum =
    db
      .select({ n: sql<number>`coalesce(sum(credits_remaining),0)` })
      .from(creditBatches)
      .where(eq(creditBatches.userId, user.id))
      .get()?.n ?? 0;
  check(
    "ledger total equals credits remaining across all batches",
    ledgerSum === batchSum,
    { ledgerSum, batchSum },
  );

  /* cleanup */
  const testUsers = [user, broke, ...fillers];
  for (const u of testUsers) {
    sqlite.prepare("delete from bookings where user_id = ?").run(u.id);
    sqlite.prepare("delete from credit_ledger where user_id = ?").run(u.id);
    sqlite.prepare("delete from credit_batches where user_id = ?").run(u.id);
    sqlite.prepare("delete from users where id = ?").run(u.id);
  }
  /* Every fixture registers itself in fixtureSessionIds, so cleaning up from
     that list cannot fall out of step with the fixtures again — which it just
     did, when one of three hard-coded names was renamed. */
  if (fixtureSessionIds.length > 0) {
    sqlite
      .prepare(
        `delete from class_sessions where id in (${fixtureSessionIds
          .map(() => "?")
          .join(",")})`,
      )
      .run(...fixtureSessionIds);
  }

  /* ---------------------------------------------------------------- 10 */
  console.log("\n10. What the automatic messages actually say");
  {
    const { whenWords, leadWords } = await import("../src/lib/messaging/events");

    /* The whole substance of a booking confirmation is the day and the hour, in
       the studio's timezone — a member in London booking a class at 18:00 in
       Larnaca must be told 18:00, not 16:00. */
    const at = new Date("2026-08-29T15:00:00Z"); // 18:00 in Nicosia
    const words = whenWords(at);
    check(
      "the confirmation names the weekday, the date and the hour",
      /Saturday/.test(words) && /29 August/.test(words) && /18:00/.test(words),
      words,
    );

    check("a two-hour lead reads as hours", leadWords(120) === "2 hours", leadWords(120));
    check("one hour is not pluralised", leadWords(60) === "1 hour", leadWords(60));
    check("ninety minutes stays legible", leadWords(90) === "1h 30m", leadWords(90));
    check("ten minutes reads as minutes", leadWords(10) === "10 minutes", leadWords(10));
    /* A sweep that runs a moment late must not say "in -1 minutes". */
    check("a late sweep says now, not a negative", leadWords(0) === "now", leadWords(0));

    /* ---- the Greek half, which half the members will be reading ---- */
    const W = await import("../src/lib/messaging/wording");

    const greekWhen = W.whenWords(at, "el");
    check(
      "the Greek names the weekday and month in Greek",
      /Σάββατο/.test(greekWhen) && /Αυγούστου/.test(greekWhen) && /18:00/.test(greekWhen),
      greekWhen,
    );
    check(
      "and no Latin letters have leaked into it",
      !/[A-Za-z]/.test(greekWhen),
      greekWhen,
    );
    check("Greek hours inflect", W.leadWords(120, "el") === "2 ώρες", W.leadWords(120, "el"));
    check("one Greek hour is singular", W.leadWords(60, "el") === "1 ώρα", W.leadWords(60, "el"));
    check(
      "Greek sessions inflect too",
      W.sessionWords(1, "el") === "1 συνεδρία" && W.sessionWords(10, "el") === "10 συνεδρίες",
      [W.sessionWords(1, "el"), W.sessionWords(10, "el")].join(" / "),
    );
    check(
      "English sessions still pluralise",
      W.sessionWords(1) === "1 session" && W.sessionWords(10) === "10 sessions",
    );

    /* Whole euros lose the decimals; anything else keeps them. A price of
       "€200.00" on a receipt reads like a machine wrote it. */
    check("round money drops the decimals", W.moneyWords(20000, "EUR") === "€200", W.moneyWords(20000, "EUR"));
    check("uneven money keeps them", W.moneyWords(2050, "EUR").includes("20.50"), W.moneyWords(2050, "EUR"));

    /* ---- what each message actually says, in both languages ---- */
    const booked = W.bookedWords({ classEn: "Reformer Flow", classEl: "Ροή Reformer", startsAt: at });
    check("the booking confirmation is bilingual", booked.en.subject === "Booking confirmed" && booked.el.subject === "Η κράτηση επιβεβαιώθηκε");
    check("and names the class in each language", booked.en.body.includes("Reformer Flow") && booked.el.body.includes("Ροή Reformer"));

    const kept = W.cancelledWords({ classEn: "A", classEl: "Α", startsAt: at, refunded: true });
    const used = W.cancelledWords({ classEn: "A", classEl: "Α", startsAt: at, refunded: false });
    check("a refunded cancellation says the session came back", kept.en.body.includes("back in your balance"));
    check("and says so in Greek", kept.el.body.includes("επέστρεψε στο υπόλοιπό σας"));
    check("a late cancellation says the session was used", used.en.body.includes("12-hour window"));
    check("and says so in Greek", used.el.body.includes("εντός 12 ωρών"));

    const paid = W.purchasedWords({
      credits: 10,
      amountCents: 20000,
      currency: "EUR",
      expiresAt: new Date("2026-11-25T00:00:00Z"),
    });
    check("the receipt names sessions, price and expiry", /10 sessions/.test(paid.en.body) && /€200/.test(paid.en.body) && /25 November 2026/.test(paid.en.body), paid.en.body);
    check("and the Greek receipt does too", /10 συνεδρίες/.test(paid.el.body) && /Νοεμβρίου/.test(paid.el.body), paid.el.body);

    const noExpiry = W.purchasedWords({ credits: 1, amountCents: 2500, currency: "EUR", expiresAt: null });
    check(
      "a pack with no expiry promises none",
      !/expire/i.test(noExpiry.en.body) && !/Λήγουν/.test(noExpiry.el.body),
      noExpiry.en.body,
    );

    /* ---- the email envelope: one letter, two languages, signed twice ---- */
    const letter = W.forEmail(booked);
    /* One language in the subject, deliberately. An inbox shows about fifty
       characters, so two languages competing for them means neither is legible
       — and the Greek is in the body where there is room for it. */
    check("the email subject stays in one language", letter.subject === "Booking confirmed", letter.subject);
    check("and carries no separator", !letter.subject.includes("·"), letter.subject);
    check("the English comes first", letter.body.indexOf("Reformer Flow") < letter.body.indexOf("Ροή Reformer"));
    check("with a rule between them", letter.body.includes(W.LANGUAGE_RULE));
    check("signed in English", letter.body.includes("Best regards,\nAPEX pilates Team"));
    check("and signed in Greek", letter.body.includes("Με εκτίμηση,"));

    /* A desk notice the writer signed themselves must not be signed twice. That
       is what it looked like in a real inbox: "Best regards, Apex Pilates Team"
       followed by "Best regards, APEX pilates Team". */
    const handSigned = W.forEmail(
      {
        subject: "Hello Testing",
        body: "Hello we are testing,\n\nBest regards,\nApex Pilates Team",
      },
      { subject: "Γεια σας", body: "Γειααα,\n\nΚανουμε τεστινγ." },
    );
    check(
      "a notice the writer signed is not signed again",
      (handSigned.body.match(/Best regards/gi) ?? []).length === 1,
      handSigned.body,
    );
    check(
      "but the unsigned Greek half still gets one",
      handSigned.body.includes("Με εκτίμηση,"),
      handSigned.body,
    );
    /* And a message that merely mentions the words mid-sentence still gets a
       sign-off, because the check looks at the end only. */
    const mentions = W.forEmail({
      subject: "Regards",
      body: "Best regards are what we send in every email we write.\n\nThe studio is shut on Monday and reopens Tuesday at six.",
    });
    check(
      "a passing mention does not suppress the sign-off",
      mentions.body.trimEnd().endsWith("APEX pilates Team"),
      mentions.body,
    );

    /* A desk notice with no Greek typed must not produce an empty second half
       with a rule above it and a sign-off below. */
    const oneLanguage = W.forEmail({ subject: "Studio closed", body: "We are shut on Monday." });
    check("an English-only notice gets no rule", !oneLanguage.body.includes(W.LANGUAGE_RULE), oneLanguage.body);
    check("but is still signed", oneLanguage.body.endsWith("APEX pilates Team"), oneLanguage.body);
    check("and keeps its own subject", oneLanguage.subject === "Studio closed", oneLanguage.subject);

    /* The push notification is one line on a lock screen. A sign-off in it, or
       a second language, would be absurd — so the raw wording must stay clean. */
    check("the push text is not signed", !booked.en.body.includes("Best regards"));
    check("and is one language", !/[Α-Ωα-ω]/.test(booked.en.body), booked.en.body);
  }

  /* ---------------------------------------------------------------- 11 */
  console.log("\n11. The opening-week free session");
  {
    const P = await import("../src/lib/promo");
    const { spendOneCredit, getAvailableCredits: bal } = await import(
      "../src/lib/credits"
    );

    const promoUser = db
      .insert(users)
      .values({
        email: `promo-${Date.now()}@apex.test`,
        name: "Promo Tester",
        passwordHash: await hashPassword("x".repeat(10)),
      })
      .returning()
      .get();

    /* One free session, spendable only on classes in the promo week. */
    grantCredits({
      userId: promoUser.id,
      credits: 1,
      validityDays: null,
      expiresAt: P.PROMO.expiresAt,
      usableFrom: P.PROMO.spendFrom,
      usableTo: P.PROMO.spendUntil,
      source: "GRANT",
      reason: "ADMIN_GRANT",
      note: "opening week",
    });
    check("the free session is in the balance", (await bal(promoUser.id)) === 1);

    const inside = new Date(P.PROMO.spendFrom.getTime() + 36 * 3600_000);
    const outside = new Date(P.PROMO.spendUntil.getTime() + 21 * 86_400_000);
    const before = new Date(P.PROMO.spendFrom.getTime() - 3 * 86_400_000);

    check(
      "the window allows a class inside it",
      P.windowAllows(
        { usableFrom: P.PROMO.spendFrom, usableTo: P.PROMO.spendUntil },
        inside,
      ),
    );
    check(
      "and refuses one after it",
      !P.windowAllows(
        { usableFrom: P.PROMO.spendFrom, usableTo: P.PROMO.spendUntil },
        outside,
      ),
    );
    check(
      "and one before it",
      !P.windowAllows(
        { usableFrom: P.PROMO.spendFrom, usableTo: P.PROMO.spendUntil },
        before,
      ),
    );
    check(
      "an ordinary bought session is allowed on any date",
      P.windowAllows({ usableFrom: null, usableTo: null }, outside),
    );

    /* THE bug this whole feature turns on. Before the window existed, a free
       session could be spent on any class at all — so a member would book
       November, silently burn it, and have nothing for the week it was for. */
    const stolen = spendOneCredit(
      promoUser.id,
      { note: "a class outside the promo week", classStartsAt: outside },
      new Date(P.PROMO.spendFrom.getTime() - 86_400_000),
    );
    check("a free session cannot pay for a class outside the week", stolen === null, stolen);
    check("and is still in the balance afterwards", (await bal(promoUser.id)) === 1);

    /* Inside the week it spends normally. */
    const spent = spendOneCredit(
      promoUser.id,
      { note: "a class in the promo week", classStartsAt: inside },
      new Date(P.PROMO.spendFrom.getTime() - 86_400_000),
    );
    check("inside the week it spends", spent !== null, spent);
    check("and the balance drops", (await bal(promoUser.id)) === 0);

    /* With both a free session and a bought pack, the right one is spent for
       each class — which is the studio's requirement, stated as two rules. */
    const both = db
      .insert(users)
      .values({
        email: `promo-both-${Date.now()}@apex.test`,
        name: "Promo And Pack",
        passwordHash: await hashPassword("x".repeat(10)),
      })
      .returning()
      .get();

    grantCredits({
      userId: both.id,
      credits: 1,
      validityDays: null,
      expiresAt: P.PROMO.expiresAt,
      usableFrom: P.PROMO.spendFrom,
      usableTo: P.PROMO.spendUntil,
      source: "GRANT",
      reason: "ADMIN_GRANT",
    });
    grantCredits({
      userId: both.id,
      credits: 5,
      validityDays: 90,
      source: "PURCHASE",
      reason: "PURCHASE",
      note: "a bought pack",
    });
    check("they hold six sessions", (await bal(both.id)) === 6);

    const atClass = new Date(P.PROMO.spendFrom.getTime() - 86_400_000);

    /* A promo-week class must take the free one first: it expires soonest and it
       is valid, so the member gets the benefit rather than losing it. */
    const promoBatch = spendOneCredit(
      both.id,
      { classStartsAt: inside },
      atClass,
    );
    const promoRow = db
      .select()
      .from(creditBatches)
      .where(eq(creditBatches.id, promoBatch!))
      .get()!;
    check(
      "a promo-week class spends the free session, not the pack",
      promoRow.usableFrom !== null,
      { source: promoRow.source, usableFrom: promoRow.usableFrom },
    );

    /* And a class outside the week must take the pack, leaving the free one. */
    const packBatch = spendOneCredit(
      both.id,
      { classStartsAt: outside },
      atClass,
    );
    const packRow = db
      .select()
      .from(creditBatches)
      .where(eq(creditBatches.id, packBatch!))
      .get()!;
    check(
      "a later class spends the pack, not the free session",
      packRow.usableFrom === null,
      { source: packRow.source, usableFrom: packRow.usableFrom },
    );

    /* The grant window: who qualifies. */
    check(
      "somebody registering inside the window qualifies",
      P.activePromo(new Date(P.PROMO.grantFrom.getTime() + 86_400_000)) !== null,
    );
    check(
      "somebody registering before it does not",
      P.activePromo(new Date(P.PROMO.grantFrom.getTime() - 86_400_000)) === null,
    );
    check(
      "and neither does somebody after it",
      P.activePromo(new Date(P.PROMO.grantUntil.getTime() + 86_400_000)) === null,
    );

    /* The dates the studio actually asked for, checked against the constants so
       a careless edit to promo.ts is caught rather than discovered in September. */
    const key = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: STUDIO.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    check("the week starts Monday 7 September", key(P.PROMO.spendFrom) === "2026-09-07", key(P.PROMO.spendFrom));
    check("and ends Saturday 12 September", key(P.PROMO.spendUntil) === "2026-09-12", key(P.PROMO.spendUntil));
    check("granting stops on 13 September", key(P.PROMO.grantUntil) === "2026-09-13", key(P.PROMO.grantUntil));
    /* The one that would go unnoticed: granting must never outlive the window
       the session can be spent in, or a new account is handed a dead credit. */
    check(
      "and never outlives the last class it could buy",
      P.PROMO.grantUntil.getTime() <= P.PROMO.spendUntil.getTime() + 24 * 60 * 60 * 1000,
      { grantUntil: key(P.PROMO.grantUntil), spendUntil: key(P.PROMO.spendUntil) },
    );
    /* The studio is closed on Sundays, so a window ending on the 20th would
       promise a day with no classes in it. */
    check("the last day of the window is not a Sunday", studioDayOfWeek(P.PROMO.spendUntil) !== 0);

    /* The wording has to name the window, or the offer is unusable. */
    const W = await import("../src/lib/messaging/wording");
    /* Called the way events.ts calls it, expiry included. The two dates used to
       be the same evening, so leaving `expires` out still produced the right
       words; now that the spend deadline outlives the last class by a day, a
       caller that omits it quietly advertises the wrong date. */
    const words = W.promoWords({
      credits: 1,
      from: P.PROMO.spendFrom,
      to: P.PROMO.spendUntil,
      expires: P.PROMO.expiresAt,
    });
    check("the message names both dates", /7 September/.test(words.en.body) && /12 September/.test(words.en.body), words.en.body);
    /* The expiry date has to be in the words, or a member saves the session for
       a week that no longer accepts it. */
    check("and says when it expires", /expires on 13 September/.test(words.en.body), words.en.body);
    /* No em dash: the studio reads one as machine-written. */
    check("and is written without an em dash", !words.en.body.includes("—") && !words.el.body.includes("—"), words.en.body);
    check("the Greek version names them too", /Σεπτεμβρίου/.test(words.el.body), words.el.body);

    /* Tidy up so a repeat run starts clean. */
    for (const u of [promoUser.id, both.id]) {
      db.delete(creditLedger).where(eq(creditLedger.userId, u)).run();
      db.delete(creditBatches).where(eq(creditBatches.userId, u)).run();
      db.delete(users).where(eq(users.id, u)).run();
    }
  }

  console.log(
    `\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`,
  );
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
