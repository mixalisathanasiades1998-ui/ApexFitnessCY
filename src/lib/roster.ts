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
    bioEn:
      "Evelina teaches the early mornings, and she likes them unhurried and strong. Calm, precise and quietly demanding, she sets your springs and your pace so every class meets you exactly where you are.",
    bioEl:
      "Η Evelina κρατά τα πρωινά, και τα θέλει ήρεμα και δυνατά. Ήρεμη, ακριβής και διακριτικά απαιτητική, ρυθμίζει τα ελατήρια και τον ρυθμό σου ώστε κάθε μάθημα να σε συναντά εκεί ακριβώς που βρίσκεσαι.",
    photoUrl: "/team/evelina-ch.jpg",
    sortOrder: 1,
  },
  {
    name: "Anna P.",
    bioEn:
      "Anna teaches with warmth and a sharp eye for form. First class or fiftieth, she finds the one cue that makes a movement click, and you leave with better posture than you walked in with.",
    bioEl:
      "Η Anna διδάσκει με ζεστασιά και κοφτερό μάτι στη λεπτομέρεια. Είτε είναι το πρώτο σου μάθημα είτε το πεντηκοστό, βρίσκει τη μία οδηγία που κάνει την κίνηση να «κουμπώσει», και φεύγεις με καλύτερη στάση σώματος απ' ό,τι ήρθες.",
    photoUrl: "/team/anna-p.jpg",
    sortOrder: 2,
  },
  {
    name: "Stephani Ch.",
    bioEn:
      "Stephani turns the fundamentals into something you look forward to. Steady, encouraging and full of energy, she builds the kind of control that carries off the reformer and into the rest of your week.",
    bioEl:
      "Η Stephani μετατρέπει τα βασικά σε κάτι που ανυπομονείς να ζήσεις. Σταθερή, ενθαρρυντική και γεμάτη ενέργεια, χτίζει τον έλεγχο που σε ακολουθεί έξω από το reformer, σε όλη σου την εβδομάδα.",
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
      "select id, edited_at from instructors where name = ? limit 1",
    );
    const insert = sqlite.prepare(
      `insert into instructors (id, name, bio_en, bio_el, photo_url, active, sort_order)
       values (?, ?, ?, ?, ?, 1, ?)`,
    );
    /* The roster refreshes bio and photo only on a row the desk has not touched.
       Once the Team tab edits an instructor it stamps edited_at, and from then
       on this leaves that row's words and picture exactly as the studio set
       them. See lib/team.ts. */
    const update = sqlite.prepare(
      `update instructors
          set photo_url = ?, sort_order = ?, bio_en = ?, bio_el = ?
        where id = ? and edited_at is null`,
    );

    for (const m of INSTRUCTOR_ROSTER) {
      const row = findByName.get(m.name) as
        | { id: string; edited_at: number | null }
        | undefined;
      if (!row) {
        /* A roster name missing from the table is inserted; anyone already
           there is left in place. */
        const id = crypto.randomUUID();
        insert.run(id, m.name, m.bioEn, m.bioEl, m.photoUrl, m.sortOrder);
      } else if (row.edited_at == null) {
        update.run(m.photoUrl, m.sortOrder, m.bioEn, m.bioEl, row.id);
      }
    }

    /* Nobody is ever deactivated here. Hiding an instructor is the Team tab's
       job now, so a name leaving the code roster does not remove them from the
       page — the desk decides that. */

    /* The map every caller wants: name → id for every active instructor, the
       desk's own additions included, so a schedule name always resolves. */
    const active = sqlite
      .prepare("select id, name from instructors where active = 1")
      .all() as { id: string; name: string }[];
    for (const r of active) map.set(r.name, r.id);
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
