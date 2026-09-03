import { and, eq, gte, sql } from "drizzle-orm";
import {
  SATURDAY_CLASS_HOURS,
  WEEKDAY_CLASS_HOURS,
  openingBlocks,
} from "./rota";
import { db } from "@/db";
import { bookings, classSessions, classTemplates } from "@/db/schema";
import {
  studioAddDays,
  studioDayOfWeek,
  studioParts,
  studioStartOfDay,
  studioWallTimeToInstant,
} from "./time";

/**
 * Turn the weekly templates into real bookable sessions.
 *
 * The weekly rota — "Reformer Flow, Mondays at 06:00" — is a template. A member
 * cannot book a template; they book a class on a date. This walks forward the
 * number of weeks asked for and writes a real class for every day a template
 * falls on, which is what puts it on the timetable.
 *
 * Times are studio wall-clock times, so a 06:00 template produces a class at
 * 06:00 in Nicosia no matter what timezone the server runs in.
 *
 * **Idempotent, which is the important property.** (templateId, startsAt) is
 * unique, so running it twice never doubles a class up: the second run reports
 * everything as skipped and changes nothing. Pressing the button by accident is
 * therefore not a mistake that needs undoing — but the ids of what it did create
 * are returned anyway, so that a run which went further ahead than intended can
 * be taken back. See `removeGeneratedSessions`.
 */
/**
 * How far ahead the timetable runs, in days. One number, read by everybody.
 *
 * Ninety days, because the studio sells three-month packs. Somebody who has just
 * paid for twelve weeks of classes and can only see four of them is looking at a
 * timetable that appears to end before their sessions do — and the studio's own
 * answer to "can I book my Monday slot for the term" was "come back in a month".
 *
 * This is deliberately a single constant rather than a number in each of the
 * three places that needed one. It used to be 28 on the timetable page and 42 in
 * the generator, which is a difference nobody notices until the generator falls
 * behind the page and the last fortnight of the strip quietly shows nothing.
 */
export const TIMETABLE_DAYS = 90;

/** The same horizon, in the weeks that `generateSessions` counts in. */
export const TIMETABLE_WEEKS = Math.ceil(TIMETABLE_DAYS / 7);

export function generateSessions(weeksAhead = TIMETABLE_WEEKS, from = new Date()) {
  const templates = db
    .select()
    .from(classTemplates)
    .where(eq(classTemplates.active, true))
    .all();

  const start = studioStartOfDay(from);
  const days = weeksAhead * 7;
  const createdIds: string[] = [];
  let created = 0;
  let skipped = 0;

  db.transaction(() => {
    for (let i = 0; i < days; i++) {
      const dayInstant = studioAddDays(start, i);
      const dow = studioDayOfWeek(dayInstant);
      const p = studioParts(dayInstant);

      for (const tpl of templates) {
        if (tpl.dayOfWeek !== dow) continue;

        const startsAt = studioWallTimeToInstant(
          p.year,
          p.month,
          p.day,
          Math.floor(tpl.startMinutes / 60),
          tpl.startMinutes % 60,
        );

        if (startsAt.getTime() < from.getTime()) {
          skipped++;
          continue;
        }
        const endsAt = new Date(startsAt.getTime() + tpl.durationMin * 60_000);

        const row = db
          .insert(classSessions)
          .values({
            classTypeId: tpl.classTypeId,
            instructorId: tpl.instructorId,
            templateId: tpl.id,
            startsAt,
            endsAt,
            capacity: tpl.capacity,
          })
          .onConflictDoNothing()
          .returning({ id: classSessions.id })
          .get();
        if (row) {
          created++;
          createdIds.push(row.id);
        } else skipped++;
      }
    }
  });

  return { created, skipped, templates: templates.length, createdIds };
}

/**
 * Keep the far end of the timetable full, without anybody remembering to.
 *
 * `generateSessions` writes a fixed number of weeks from today, which means the
 * horizon does not move on its own: every day that passes, the last bookable
 * day gets one day closer, and after three months of nobody pressing Generate
 * at the desk the timetable simply stops. That was survivable while the page
 * showed four weeks of a six-week horizon — two weeks of slack nobody saw. It
 * is not survivable now the page shows the whole ninety days, because the
 * shortfall is on screen as a run of empty days.
 *
 * So this runs from the cron sweep, and it is deliberately lazy. It reads one
 * number — the furthest class on the books — and does nothing at all unless the
 * horizon has drifted more than a fortnight short. On a studio whose templates
 * have not changed, that is a single `max()` per sweep and no writes for weeks
 * at a time.
 *
 * The fortnight of tolerance is what stops this generating a handful of classes
 * every single day: when it does fire it fills the whole ninety days at once,
 * and then has nothing to do again for two weeks.
 */
export function rollTimetableForward(now = new Date()) {
  const furthest = db
    .select({ last: sql<number>`max(${classSessions.startsAt})` })
    .from(classSessions)
    .get();

  /* Stored as whole Unix seconds — see the schema. Null means an empty
     timetable, which is exactly the case that needs generating. */
  const lastAt = furthest?.last ? Number(furthest.last) * 1000 : 0;
  const wanted = studioAddDays(studioStartOfDay(now), TIMETABLE_DAYS).getTime();
  const slack = 14 * 86_400_000;

  if (lastAt >= wanted - slack) {
    return { rolled: false, created: 0, lastAt: lastAt || null };
  }

  const gen = generateSessions(TIMETABLE_WEEKS, now);
  console.log(
    `[timetable] horizon was short, rolled forward: ${gen.created} classes created`,
  );
  return { rolled: true, created: gen.created, lastAt: lastAt || null };
}

/**
 * Undo one roll-forward.
 *
 * Only the classes that run passed back, and only the ones nobody has booked:
 * a class with a member on it is not an accident to be tidied away, it is a
 * commitment. Those are reported as kept rather than silently ignored, so the
 * desk is told why the numbers do not match.
 *
 * There is no time limit on this and no need for one — the ids are the whole
 * scope, and a class that has since been booked protects itself.
 */
export function removeGeneratedSessions(ids: string[]) {
  if (ids.length === 0) return { removed: 0, kept: 0 };

  let removed = 0;
  let kept = 0;

  db.transaction(() => {
    for (const id of ids) {
      const taken = db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.sessionId, id), eq(bookings.status, "CONFIRMED")))
        .all().length;

      if (taken > 0) {
        kept++;
        continue;
      }
      removed += db.delete(classSessions).where(eq(classSessions.id, id)).run()
        .changes;
    }
  });

  return { removed, kept };
}

export async function countUpcomingSessions(from = new Date()) {
  const rows = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(gte(classSessions.startsAt, from), eq(classSessions.status, "SCHEDULED")),
    );
  return rows.length;
}

/**
 * Studio opening hours, used by the marketing pages and the footer.
 *
 * Computed from the rota rather than written out, so the hours a member reads
 * cannot disagree with the classes they can actually book. See lib/rota.ts.
 */
export const STUDIO_HOURS = [
  {
    key: "weekday",
    days: [1, 2, 3, 4, 5],
    blocks: openingBlocks(WEEKDAY_CLASS_HOURS),
  },
  { key: "saturday", days: [6], blocks: openingBlocks(SATURDAY_CLASS_HOURS) },
  { key: "sunday", days: [0], blocks: [] as string[] },
] as const;
