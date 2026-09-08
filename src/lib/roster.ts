import { sqlite } from "@/db";

/**
 * The studio's instructors, in one place — and the one thing that makes the
 * roster authoritative on a live database rather than only on a fresh seed.
 *
 * The problem this solves. The instructor list used to live only inside the
 * seed, and the seed runs once, on the first boot of an empty database. So when
 * the studio replaced its four placeholder instructors with the three real ones,
 * editing the seed changed nothing on a site that had already been seeded: the
 * old four were still in the table, still `active`, and still on the studio page.
 *
 * So the roster is reconciled on boot, the same way the timetable is. The three
 * below are upserted by name, and any instructor whose name is not among them is
 * switched off — not deleted, because past classes still point at whoever taught
 * them, and a member's history is not ours to rewrite. `getInstructors` and the
 * admin only ever read `active` rows, so switching an old name off is all it
 * takes for it to leave the site.
 *
 * `name` must match the schedule in `lib/rota.ts` exactly: the schedule names
 * who teaches each hour, and the reconcile below is what turns those names into
 * the ids the templates and classes carry.
 */
export type RosterMember = {
  name: string;
  bioEn: string;
  bioEl: string;
  photoUrl: string;
  sortOrder: number;
};

export const INSTRUCTOR_ROSTER: readonly RosterMember[] = [
  {
    name: "Evelina Ch.",
    bioEn: "Reformer instructor at APEX pilates.",
    bioEl: "Εκπαιδεύτρια Reformer στο APEX pilates.",
    photoUrl: "/team/evelina-ch.jpg",
    sortOrder: 1,
  },
  {
    name: "Anna P.",
    bioEn: "Reformer instructor at APEX pilates.",
    bioEl: "Εκπαιδεύτρια Reformer στο APEX pilates.",
    photoUrl: "/team/anna-p.jpg",
    sortOrder: 2,
  },
  {
    name: "Stephani Ch.",
    bioEn: "Reformer instructor at APEX pilates.",
    bioEl: "Εκπαιδεύτρια Reformer στο APEX pilates.",
    photoUrl: "/team/stephani-ch.jpg",
    sortOrder: 3,
  },
] as const;

/**
 * Bring the instructors table in line with the roster, and hand back a
 * name → id map for whoever needs to turn a schedule name into a row.
 *
 * Idempotent: the second run updates the same rows to the same values and
 * switches nothing new off. Safe to call from a page render; it is one small
 * transaction. Bios are only written when the row is created or is still blank,
 * so a bio edited at the desk is never stamped back over.
 */
export function reconcileRoster(): Map<string, string> {
  const map = new Map<string, string>();

  const hasTable = sqlite
    .prepare(
      "select name from sqlite_master where type='table' and name='instructors'",
    )
    .get();
  if (!hasTable) return map;

  sqlite.transaction(() => {
    const findByName = sqlite.prepare(
      "select id, bio_en, bio_el from instructors where name = ? limit 1",
    );
    const insert = sqlite.prepare(
      `insert into instructors (id, name, bio_en, bio_el, photo_url, active, sort_order)
       values (?, ?, ?, ?, ?, 1, ?)`,
    );
    const update = sqlite.prepare(
      `update instructors
          set photo_url = ?, sort_order = ?, active = 1,
              bio_en = case when bio_en = '' then ? else bio_en end,
              bio_el = case when bio_el = '' then ? else bio_el end
        where id = ?`,
    );

    for (const m of INSTRUCTOR_ROSTER) {
      const row = findByName.get(m.name) as { id: string } | undefined;
      if (row) {
        update.run(m.photoUrl, m.sortOrder, m.bioEn, m.bioEl, row.id);
        map.set(m.name, row.id);
      } else {
        const id = crypto.randomUUID();
        insert.run(id, m.name, m.bioEn, m.bioEl, m.photoUrl, m.sortOrder);
        map.set(m.name, id);
      }
    }

    /* Everyone not on the roster is switched off. Placeholders from an earlier
       seed, an instructor who has left — both stop appearing without their
       past classes losing the name attached to them. */
    const names = INSTRUCTOR_ROSTER.map((m) => m.name);
    const placeholders = names.map(() => "?").join(", ");
    sqlite
      .prepare(
        `update instructors set active = 0
          where active = 1 and name not in (${placeholders})`,
      )
      .run(...names);
  })();

  return map;
}

let done = false;

/** Reconcile once per process, for read paths that only need it done. */
export function reconcileRosterOnce() {
  if (done) return;
  done = true;
  try {
    reconcileRoster();
  } catch (err) {
    /* A roster that fails to reconcile must not take the page down: the old
       names showing is better than a 500. */
    console.error("[roster] reconcile failed", err);
  }
}
