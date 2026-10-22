import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  classSessions,
  classTemplates,
  classTypes,
  slotMoves,
} from "@/db/schema";
import { cancelReminder, scheduleReminder } from "./reminders";
import {
  studioDateKey,
  studioDayOfWeek,
  studioParts,
  studioStartOfDay,
  studioWallTimeToInstant,
} from "./time";

/**
 * Moving a class to another time, from the console. Owner only.
 *
 * Two ways, the answer to one question in the dialog:
 *
 *   ONE     this class only, on its own day.
 *   WEEKLY  this class and the same slot every week from this day on.
 *
 * The rules, the same for both:
 *
 *   - Same day, new time, in 5-minute steps, still ahead of now. A class never
 *     changes day here; that would be a different class.
 *   - One room: refused if the new time overlaps any other class that day.
 *   - Members already booked keep their place and are told. Their booking is
 *     stamped `movedAt`, which lets them cancel for free right up to the start:
 *     they said yes to the old time, not this one.
 *   - Reminders move with the class.
 *
 * **Why WEEKLY writes a row in `slot_moves` rather than editing the template.**
 * The weekly timetable is written in code (lib/rota.ts) and the templates are
 * put back to it on every start, so a time saved on a template would quietly
 * return to the old hour at the next deploy. The move is stored on its own and
 * applied on top: here for the classes that already exist, and by the class
 * generator for every week it creates later.
 *
 * A class moved on its own (ONE) keeps `movedFrom`, and a later WEEKLY move
 * leaves it at the time the desk chose for it.
 */

export const MOVE_STEP_MINUTES = 5;

export type MoveScope = "ONE" | "WEEKLY";

export type MoveResult =
  | {
      ok: true;
      scope: MoveScope;
      /** Classes whose time changed. */
      moved: number;
      /** Members told. */
      members: number;
      startsAt: string;
      endsAt: string;
    }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "NOT_GROUP"
        | "CANCELLED"
        | "PAST"
        | "BAD_TIME"
        | "NOT_CHANGED"
        | "CLASH"
        | "NOT_WEEKLY";
      /** For CLASH: when the class in the way starts. */
      clashAt?: string;
    };

/** "HH:MM" to minutes from midnight, on the 5-minute grid; null otherwise. */
export function parseClock(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59 || min % MOVE_STEP_MINUTES !== 0) return null;
  return h * 60 + min;
}

/** A studio calendar day plus minutes from midnight, as an instant. */
function at(dayInstant: Date, minutes: number) {
  const p = studioParts(dayInstant);
  return studioWallTimeToInstant(
    p.year,
    p.month,
    p.day,
    Math.floor(minutes / 60),
    minutes % 60,
  );
}

type MoveRow = { toMinutes: number; effectiveFrom: string; createdAt: Date };

/** Every saved weekly move, newest first, by template. */
export function loadSlotMoves(): Map<string, MoveRow[]> {
  const out = new Map<string, MoveRow[]>();
  const rows = db
    .select()
    .from(slotMoves)
    .orderBy(desc(slotMoves.effectiveFrom), desc(slotMoves.createdAt))
    .all();
  for (const r of rows) {
    const list = out.get(r.templateId) ?? [];
    list.push({
      toMinutes: r.toMinutes,
      effectiveFrom: r.effectiveFrom,
      createdAt: r.createdAt,
    });
    out.set(r.templateId, list);
  }
  return out;
}

/**
 * The minute a slot starts on a given day: the latest move that has come into
 * force by that day, else the template's own time.
 */
export function slotMinutesOn(
  moves: Map<string, MoveRow[]>,
  templateId: string,
  templateMinutes: number,
  dayKey: string,
): number {
  const list = moves.get(templateId);
  if (!list) return templateMinutes;
  /* Newest first, so the first one in force is the one that applies. */
  const hit = list.find((m) => m.effectiveFrom <= dayKey);
  return hit ? hit.toMinutes : templateMinutes;
}

/** Another scheduled class overlapping [start, end), not one of `exclude`. */
function clashWith(start: Date, end: Date, exclude: string[]) {
  return db
    .select({ id: classSessions.id, startsAt: classSessions.startsAt })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.status, "SCHEDULED"),
        lt(classSessions.startsAt, end),
        gt(classSessions.endsAt, start),
        ...(exclude.length ? [ne(classSessions.id, exclude[0]!)] : []),
      ),
    )
    .all()
    .find((r) => !exclude.includes(r.id));
}

/**
 * Who is booked on these classes, and the move written onto their bookings.
 * Returns what the notification needs, per member.
 */
function moveBookings(
  sessionIds: string[],
  times: Map<string, { from: Date; to: Date }>,
  now: Date,
) {
  if (sessionIds.length === 0) return [] as MovedFor[];
  const rows = db
    .select({ id: bookings.id, userId: bookings.userId, sessionId: bookings.sessionId })
    .from(bookings)
    .where(
      and(inArray(bookings.sessionId, sessionIds), eq(bookings.status, "CONFIRMED")),
    )
    .all();
  if (rows.length === 0) return [];
  db.update(bookings)
    .set({ movedAt: now })
    .where(inArray(bookings.id, rows.map((r) => r.id)))
    .run();
  return rows.map((r) => ({
    userId: r.userId,
    bookingId: r.id,
    from: times.get(r.sessionId)!.from,
    to: times.get(r.sessionId)!.to,
  }));
}

export type MovedFor = { userId: string; bookingId: string; from: Date; to: Date };

/**
 * Move a class, or its weekly slot from that day on.
 *
 * Everything is checked before anything is written, and the writes happen in
 * one transaction. `onMoved` receives the bookings that moved, for the
 * notifications, which are sent afterwards and never inside the transaction.
 */
export function moveClass(args: {
  sessionId: string;
  newStart: string;
  scope: MoveScope;
  staffName: string;
  now?: Date;
}): MoveResult & { movedFor?: MovedFor[] } {
  const now = args.now ?? new Date();
  const minutes = parseClock(args.newStart);
  if (minutes === null) return { ok: false, code: "BAD_TIME" };

  const row = db
    .select({ s: classSessions, kind: classTypes.kind })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(eq(classSessions.id, args.sessionId))
    .get();
  if (!row) return { ok: false, code: "NOT_FOUND" };
  const session = row.s;
  if (row.kind !== "GROUP") return { ok: false, code: "NOT_GROUP" };
  if (session.status !== "SCHEDULED") return { ok: false, code: "CANCELLED" };
  if (session.startsAt.getTime() <= now.getTime()) {
    return { ok: false, code: "PAST" };
  }

  const length = session.endsAt.getTime() - session.startsAt.getTime();
  /* A class must end the day it starts. */
  if (minutes * 60_000 + length > 24 * 60 * 60_000) {
    return { ok: false, code: "BAD_TIME" };
  }
  const day = studioStartOfDay(session.startsAt);
  const newStart = at(day, minutes);
  const newEnd = new Date(newStart.getTime() + length);
  if (newStart.getTime() <= now.getTime() + 60_000) {
    return { ok: false, code: "PAST" };
  }

  /* -------------------------------------------------------- this class only */
  if (args.scope === "ONE") {
    if (newStart.getTime() === session.startsAt.getTime()) {
      return { ok: false, code: "NOT_CHANGED" };
    }
    const clash = clashWith(newStart, newEnd, [session.id]);
    if (clash) {
      return { ok: false, code: "CLASH", clashAt: clash.startsAt.toISOString() };
    }

    let movedFor: MovedFor[] = [];
    db.transaction(() => {
      const original = session.movedFrom ?? session.startsAt;
      db.update(classSessions)
        .set({
          startsAt: newStart,
          endsAt: newEnd,
          /* Back at its original time, it is an ordinary class again and will
             follow its slot if the slot moves. */
          movedFrom:
            original.getTime() === newStart.getTime() ? null : original,
        })
        .where(eq(classSessions.id, session.id))
        .run();
      movedFor = moveBookings(
        [session.id],
        new Map([[session.id, { from: session.startsAt, to: newStart }]]),
        now,
      );
    });
    for (const m of movedFor) {
      cancelReminder(m.bookingId);
      scheduleReminder(m.bookingId, now);
    }
    return {
      ok: true,
      scope: "ONE",
      moved: 1,
      members: new Set(movedFor.map((m) => m.userId)).size,
      startsAt: newStart.toISOString(),
      endsAt: newEnd.toISOString(),
      movedFor,
    };
  }

  /* ---------------------------------------------- every week from this day */
  if (!session.templateId) return { ok: false, code: "NOT_WEEKLY" };
  const template = db
    .select()
    .from(classTemplates)
    .where(eq(classTemplates.id, session.templateId))
    .get();
  if (!template) return { ok: false, code: "NOT_WEEKLY" };

  const effectiveFrom = studioDateKey(session.startsAt);
  const moves = loadSlotMoves();

  /* The classes that move: this one, and every scheduled class of the same
     slot from this day on that has not been moved on its own. */
  const affected = db
    .select()
    .from(classSessions)
    .where(
      and(
        eq(classSessions.templateId, template.id),
        eq(classSessions.status, "SCHEDULED"),
        gte(classSessions.startsAt, day),
        or(isNull(classSessions.movedFrom), eq(classSessions.id, session.id)),
      ),
    )
    .orderBy(asc(classSessions.startsAt))
    .all();

  const plan = affected
    .map((s) => {
      const len = s.endsAt.getTime() - s.startsAt.getTime();
      const to = at(studioStartOfDay(s.startsAt), minutes);
      return { s, to, end: new Date(to.getTime() + len) };
    })
    .filter((p) => p.to.getTime() !== p.s.startsAt.getTime());

  const slotAlready =
    slotMinutesOn(moves, template.id, template.startMinutes, effectiveFrom) ===
    minutes;
  /* A later-dated move for this slot would still take over from its own date,
     so the slot is only "already there" when there is none. */
  const laterMoves = (moves.get(template.id) ?? []).some(
    (m) => m.effectiveFrom > effectiveFrom,
  );
  if (plan.length === 0 && slotAlready && !laterMoves) {
    return { ok: false, code: "NOT_CHANGED" };
  }

  /* One room: nothing that moves may land on another class. */
  const movingIds = affected.map((s) => s.id);
  for (const p of plan) {
    const clash = clashWith(p.to, p.end, movingIds);
    if (clash) {
      return { ok: false, code: "CLASH", clashAt: clash.startsAt.toISOString() };
    }
  }
  /* And the weeks not generated yet: no other slot on this weekday may sit
     where this one is going, at any time it is set to from this day on. */
  const others = db
    .select()
    .from(classTemplates)
    .where(
      and(
        eq(classTemplates.active, true),
        eq(classTemplates.dayOfWeek, template.dayOfWeek),
        ne(classTemplates.id, template.id),
      ),
    )
    .all();
  const len = template.durationMin;
  for (const o of others) {
    const times = new Set<number>([
      slotMinutesOn(moves, o.id, o.startMinutes, effectiveFrom),
      ...(moves.get(o.id) ?? [])
        .filter((m) => m.effectiveFrom > effectiveFrom)
        .map((m) => m.toMinutes),
    ]);
    for (const t of times) {
      if (t < minutes + len && t + o.durationMin > minutes) {
        return {
          ok: false,
          code: "CLASH",
          clashAt: at(day, t).toISOString(),
        };
      }
    }
  }

  let movedFor: MovedFor[] = [];
  db.transaction(() => {
    /* This move covers every week from its date, so any move saved for this
       slot from the same date or later is replaced by it. Without this an
       older move with a later date would quietly win again for the weeks the
       timetable has not generated yet. */
    db.delete(slotMoves)
      .where(
        and(
          eq(slotMoves.templateId, template.id),
          gte(slotMoves.effectiveFrom, effectiveFrom),
        ),
      )
      .run();
    db.insert(slotMoves)
      .values({
        templateId: template.id,
        toMinutes: minutes,
        effectiveFrom,
        createdBy: args.staffName,
      })
      .run();
    for (const p of plan) {
      db.update(classSessions)
        .set({ startsAt: p.to, endsAt: p.end, movedFrom: null })
        .where(eq(classSessions.id, p.s.id))
        .run();
    }
    movedFor = moveBookings(
      plan.map((p) => p.s.id),
      new Map(plan.map((p) => [p.s.id, { from: p.s.startsAt, to: p.to }])),
      now,
    );
  });
  for (const m of movedFor) {
    cancelReminder(m.bookingId);
    scheduleReminder(m.bookingId, now);
  }

  return {
    ok: true,
    scope: "WEEKLY",
    moved: plan.length,
    members: new Set(movedFor.map((m) => m.userId)).size,
    startsAt: newStart.toISOString(),
    endsAt: newEnd.toISOString(),
    movedFor,
  };
}

/** The weekday of a class, 0 = Sunday, in the studio's calendar. */
export function weekdayOf(d: Date) {
  return studioDayOfWeek(d);
}
