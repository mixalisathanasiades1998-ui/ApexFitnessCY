import { sqlite } from "@/db";
import { OFFERED_PACK_SLUGS, PACKS } from "./packs";

/**
 * Bring the catalogue in the database in line with what the studio actually
 * sells, on the first read after boot.
 *
 * `packs.ts` is the price list. This makes the database agree with it — writing
 * in what is new, correcting what has changed, and withdrawing what is gone.
 *
 * ---
 *
 * **Why it writes as well as withdraws.**
 *
 * It used to only deactivate. That was half a job, and the half it left out
 * produced the worst possible intermediate state: the studio's new price list
 * replaced nine packs at once, so on the next boot this withdrew the three old
 * ones and *nothing put the new ones in* — because inserting was the seed
 * script's job and the seed script only runs when somebody runs it. The pricing
 * page went down to a single pack at last month's price, live, until a human
 * remembered a command.
 *
 * A price change should not need a manual step, and it certainly should not be
 * able to empty the shop while waiting for one. So the sync is complete: change
 * `packs.ts`, restart, done.
 *
 * ---
 *
 * **What it does not touch.**
 *
 * Rows are matched by slug and updated in place, so the `id` survives — which
 * matters, because purchases and credit batches point at it. A withdrawn pack is
 * deactivated and never deleted, for the same reason: a member's own history
 * should not change because the studio stopped selling something.
 *
 * Offers are left alone. They live in their own table as rules against a pack,
 * and `price_cents` here is the list price the rule discounts from. Nothing the
 * desk can do writes to these columns, so there is no edit to overwrite.
 *
 * Idempotent: run it twice and the second run reports no change.
 */

let done = false;

export function repairCatalogueOnce() {
  if (done) return;
  done = true;
  repairCatalogue();
}

export type CatalogueSync = {
  /** Packs written in for the first time. */
  added: number;
  /** Packs whose price, name, validity or badge moved. */
  updated: number;
  /** Packs no longer on the list, deactivated. */
  withdrawn: number;
};

/** Exposed for tests. */
export function repairCatalogue(): CatalogueSync {
  const out: CatalogueSync = { added: 0, updated: 0, withdrawn: 0 };

  const existing = new Map<
    string,
    {
      id: string;
      name_en: string;
      name_el: string;
      credits: number;
      price_cents: number;
      validity_days: number;
      badge: string | null;
      sort_order: number;
      kind: string;
      per_day_limit: number | null;
      seats: number;
      active: number;
      edited_at: number | null;
      price_edited_at: number | null;
    }
  >(
    (
      sqlite
        .prepare(
          `select id, slug, name_en, name_el, credits, price_cents,
                  validity_days, badge, sort_order, kind, per_day_limit,
                  seats, active, edited_at, price_edited_at
             from credit_packages`,
        )
        .all() as ({ slug: string } & Record<string, never>)[]
    ).map((r) => [r.slug, r as never]),
  );

  const insert = sqlite.prepare(
    `insert into credit_packages
       (id, slug, name_en, name_el, credits, price_cents, validity_days,
        badge, sort_order, kind, per_day_limit, seats, active)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  );
  const update = sqlite.prepare(
    `update credit_packages
        set name_en = ?, name_el = ?, credits = ?, price_cents = ?,
            validity_days = ?, badge = ?, sort_order = ?, kind = ?,
            per_day_limit = ?, seats = ?, active = 1
      where id = ?`,
  );

  for (const p of PACKS) {
    const row = existing.get(p.slug);
    if (!row) {
      insert.run(
        crypto.randomUUID(),
        p.slug,
        p.nameEn,
        p.nameEl,
        p.credits,
        p.priceCents,
        p.validityDays,
        p.badge,
        p.sortOrder,
        p.kind,
        p.perDayLimit,
        p.seats,
      );
      out.added++;
      continue;
    }
    /* The desk owns this row once it has touched it. A pack the owner has edited
       is left exactly as they left it — name, price, validity, whether it is on
       sale — and the code price list no longer speaks for it. */
    if (row.edited_at != null) continue;
    /* A price the desk has set is kept even on a row it has not otherwise
       claimed. In practice editing always stamps edited_at too, so this is
       belt-and-braces; it means a desk price can never be silently reverted to
       the code price by a boot. */
    const price = row.price_edited_at != null ? row.price_cents : p.priceCents;
    /* Only write when something actually differs, so a healthy boot performs no
       writes at all and the counts mean what they say. */
    const same =
      row.name_en === p.nameEn &&
      row.name_el === p.nameEl &&
      row.credits === p.credits &&
      row.price_cents === price &&
      row.validity_days === p.validityDays &&
      (row.badge ?? null) === (p.badge ?? null) &&
      row.sort_order === p.sortOrder &&
      row.kind === p.kind &&
      (row.per_day_limit ?? null) === (p.perDayLimit ?? null) &&
      row.seats === p.seats &&
      row.active === 1;
    if (same) continue;
    update.run(
      p.nameEn,
      p.nameEl,
      p.credits,
      price,
      p.validityDays,
      p.badge,
      p.sortOrder,
      p.kind,
      p.perDayLimit,
      p.seats,
      row.id,
    );
    out.updated++;
  }

  const slugs = [...OFFERED_PACK_SLUGS];
  /* Withdraw only rows the desk has never edited. A desk-made pack (slug
     "desk-…") is not on the code list and must not be deactivated for it, and an
     edited code pack the owner chose to keep on sale stays on sale. */
  out.withdrawn = sqlite
    .prepare(
      `update credit_packages
          set active = 0
        where active = 1
          and edited_at is null
          and slug not in (${slugs.map(() => "?").join(", ")})`,
    )
    .run(...slugs).changes;

  return out;
}
