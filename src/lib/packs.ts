/**
 * The session packs the studio sells, and the portraits of the people teaching.
 *
 * Both used to live only in the seed script, which meant withdrawing a pack or
 * adding a photograph did nothing until somebody remembered to run
 * `npm run db:seed`. Anyone pulling the repo and starting the dev server saw
 * the old catalogue and wondered why the change had not landed.
 *
 * So this file is the source of truth, the seed reads from it, and the
 * catalogue repairs itself against it on first read (see catalogue-repair.ts).
 * The database still holds the rows — purchases and credit batches point at
 * them — but the list of what is on sale is decided here.
 */

/**
 * Which commitment a pack belongs to.
 *
 * The price list needs it because "Monthly · 3 a week" and "3 months · 1 a week"
 * are both twelve classes and a visitor reading nine cards in a grid cannot see
 * which is which. Grouped under headings, the choice is obvious: how often do I
 * train, and for how long am I committing.
 *
 * `personal` is the odd one and is meant to be. Those two packs do not buy a
 * place in a class at all, so they sit under their own heading at the foot of
 * the list rather than competing with the plans above them on price per session,
 * a comparison that would make a one to one look like a bad deal for something
 * it is not selling.
 */
export type PackGroup =
  | "single"
  | "month"
  | "quarter"
  | "half"
  | "nine"
  | "year"
  /** The midday appointments. Their own group again, and at the foot of the
   *  page: see the note on CARD_GROUPS. */
  | "personal";

/**
 * What a pack's sessions can be spent on.
 *
 *   CLASS      a place in a group class on the timetable
 *   PERSONAL   a midday appointment, one member and one instructor
 *   DUET       the same appointment for two people, on one session
 *
 * The three are not interchangeable in either direction, which is the point.
 * See credit_batches.kind in the schema.
 */
export type CreditKind = "CLASS" | "PERSONAL" | "DUET";

/**
 * The pricing page, in the order somebody reads it.
 *
 * ---
 *
 * **How this settled where it is.**
 *
 * It began as twenty-three cards, which was fourteen thousand pixels of
 * near-identical rectangles on a phone. Then it became one card and a builder
 * for everything, which fixed the length and went too far the other way: the
 * two plans people actually buy — a month and a term — stopped being things you
 * could see and compare, and became something you had to operate a control to
 * find out about.
 *
 * So the split is by how the decision is made, not by how many cards it costs.
 * A month and three months are the ordinary choices, so they are cards you can
 * read side by side. Six, nine and twelve months are the same product bought
 * for longer, and nobody browses those: somebody arrives already knowing they
 * want a year, and one control is a better way to say so than twelve cards.
 *
 * **And the appointments moved to the bottom.** Personal and Duet sat at the
 * top with the day pass under "One at a time", which is true and put the two
 * most expensive per-session things on the page in front of everything else.
 * They are a different product for a different reason, they cost more per hour
 * than any plan costs per class, and leading with them makes the studio look
 * expensive before anybody has seen what a class costs.
 */
export const CARD_GROUPS = [
  "single",
  "month",
  "quarter",
  "personal",
] as const;

/**
 * The terms the builder covers, and deliberately have no cards.
 *
 * Kept beside `CARD_GROUPS` because the invariant that matters is the two of
 * them together: every group a pack claims has to be reachable one way or the
 * other, or the studio has a pack it cannot sell and nothing says so.
 * `test-personal` asserts exactly that.
 */
export const BUILDER_TERMS = [
  { group: "half", months: 6 },
  { group: "nine", months: 9 },
  { group: "year", months: 12 },
] as const;

/** Which card section the builder sits after. */
export const BUILDER_AFTER: PackGroup = "quarter";

export const PACKS = [
  {
    slug: "single",
    /* Was "Single class". A day pass says the same thing in the language people
       already use for it, and it does not read as the runt of a list of plans. */
    nameEn: "Day pass",
    nameEl: "Ημερήσιο πάσο",
    credits: 1,
    priceCents: 2000,
    validityDays: 30,
    badge: null as string | null,
    sortOrder: 1,
    group: "single" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },

  /* ---------------------------------------------------------------- monthly
     Priced by how many times a week somebody trains, because that is how
     people actually decide. The session count is the arithmetic of that
     choice — one a week is four — and it is what the balance is spent from. */
  {
    slug: "month-1",
    nameEn: "Monthly · 1 a week",
    nameEl: "Μηνιαίο · 1 την εβδομάδα",
    credits: 4,
    priceCents: 6000,
    validityDays: 30,
    badge: null as string | null,
    sortOrder: 2,
    group: "month" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "month-2",
    nameEn: "Monthly · 2 a week",
    nameEl: "Μηνιαίο · 2 την εβδομάδα",
    credits: 8,
    priceCents: 11000,
    validityDays: 30,
    /* The mainstream choice: twice a week at a round hundred euro. */
    badge: "POPULAR" as string | null,
    sortOrder: 3,
    group: "month" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "month-3",
    nameEn: "Monthly · 3 a week",
    nameEl: "Μηνιαίο · 3 την εβδομάδα",
    credits: 12,
    priceCents: 15000,
    validityDays: 30,
    badge: null as string | null,
    sortOrder: 4,
    group: "month" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "month-4",
    nameEn: "Monthly · 4 a week",
    nameEl: "Μηνιαίο · 4 την εβδομάδα",
    credits: 16,
    priceCents: 18000,
    validityDays: 30,
    badge: null as string | null,
    sortOrder: 5,
    group: "month" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },

  /* -------------------------------------------------------------- 3 months
     The same cadences over twelve weeks, at a lower rate per class for the
     longer commitment. Ninety days to use them, so a holiday or a bad week
     does not cost the member their money — which is the actual reason
     somebody buys three months rather than three ones. */
  {
    slug: "quarter-1",
    nameEn: "3 months · 1 a week",
    nameEl: "3 μήνες · 1 την εβδομάδα",
    credits: 12,
    priceCents: 16000,
    validityDays: 90,
    badge: null as string | null,
    sortOrder: 6,
    group: "quarter" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "quarter-2",
    nameEn: "3 months · 2 a week",
    nameEl: "3 μήνες · 2 την εβδομάδα",
    credits: 24,
    priceCents: 27000,
    validityDays: 90,
    badge: null as string | null,
    sortOrder: 7,
    group: "quarter" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "quarter-3",
    nameEn: "3 months · 3 a week",
    nameEl: "3 μήνες · 3 την εβδομάδα",
    credits: 36,
    priceCents: 37500,
    validityDays: 90,
    badge: null as string | null,
    sortOrder: 8,
    group: "quarter" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "quarter-4",
    /**
     * Unlimited, and the session count is what makes the word true.
     *
     * **The arithmetic.** The pack runs 90 days and the studio opens six days a
     * week, Monday to Saturday. Ninety days is twelve whole weeks and six days
     * over, so twelve sixes plus six is 78 training days in the quarter. That is
     * the number granted: one for every day the member could walk in.
     *
     * **Why it is not just a big balance.** 78 sessions with no other rule is
     * not an unlimited plan, it is a bulk discount somebody could spend in a
     * fortnight and then be out of sessions with ten weeks to go — which is the
     * opposite of what the word promises. So the batch carries a cap of one
     * class a day (`perDayLimit`), and the two together are the plan: train
     * every day if you like, but one a day, all quarter.
     */
    nameEn: "3 months · Unlimited",
    nameEl: "3 μήνες · Unlimited",
    credits: 78,
    priceCents: 47000,
    validityDays: 90,
    /**
     * Six euro a class if used as intended, and the badge the studio wants here.
     *
     * It moved to the twelve-month pack for a day, on the grounds that EUR 5.36
     * beats EUR 6.03 and a "best value" badge should point at the best value.
     * The studio moved it back, and with the plan builder in place that reads
     * correctly: three months is the term they are selling, the badge appears
     * on the combination somebody is most likely to land on, and the builder
     * states the longer-term discounts in its own note for anybody comparing.
     */
    badge: "BEST_VALUE" as string | null,
    sortOrder: 9,
    group: "quarter" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: 1 as number | null,
    seats: 1,
  },

  /* --------------------------------------------------------------- 6 months
     From here on the shape stops changing and only the term does: the same four
     cadences, twice the sessions, a hundred and eighty days to use them.

     Each step down the page takes a little off the price of a class — five per
     cent here, eight at nine months, twelve at a year — which is the whole
     reason to commit for longer. Without it a longer pack is only a longer
     expiry date, and nobody pays in advance for an expiry date. The percentages
     are applied to the three-month rate and then rounded to the nearest five
     euro, because a price list with 304 and 513 on it looks computed and one
     with 305 and 515 looks decided.

     Months are thirty days here, as they are for every other pack in this file:
     ninety for three, so a hundred and eighty for six. */
  {
    slug: "half-1",
    nameEn: "6 months · 1 a week",
    nameEl: "6 μήνες · 1 την εβδομάδα",
    credits: 24,
    priceCents: 30500,
    validityDays: 180,
    badge: null as string | null,
    sortOrder: 10,
    group: "half" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "half-2",
    nameEn: "6 months · 2 a week",
    nameEl: "6 μήνες · 2 την εβδομάδα",
    credits: 48,
    priceCents: 51500,
    validityDays: 180,
    badge: null as string | null,
    sortOrder: 11,
    group: "half" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "half-3",
    nameEn: "6 months · 3 a week",
    nameEl: "6 μήνες · 3 την εβδομάδα",
    credits: 72,
    priceCents: 71000,
    validityDays: 180,
    badge: null as string | null,
    sortOrder: 12,
    group: "half" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "half-4",
    nameEn: "6 months · Unlimited",
    nameEl: "6 μήνες · Unlimited",
    /* 180 days at six open days a week is 155 chances to walk
       in, so that is the ceiling — the same arithmetic as the quarter.
       `perDayLimit` is what makes it a plan rather than a bulk buy. */
    credits: 155,
    priceCents: 89500,
    validityDays: 180,
    badge: null as string | null,
    sortOrder: 13,
    group: "half" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: 1 as number | null,
    seats: 1,
  },

  /* --------------------------------------------------------------- 9 months
     Eight per cent off the three-month rate per class. */
  {
    slug: "nine-1",
    nameEn: "9 months · 1 a week",
    nameEl: "9 μήνες · 1 την εβδομάδα",
    credits: 36,
    priceCents: 44000,
    validityDays: 270,
    badge: null as string | null,
    sortOrder: 14,
    group: "nine" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "nine-2",
    nameEn: "9 months · 2 a week",
    nameEl: "9 μήνες · 2 την εβδομάδα",
    credits: 72,
    priceCents: 74500,
    validityDays: 270,
    badge: null as string | null,
    sortOrder: 15,
    group: "nine" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "nine-3",
    nameEn: "9 months · 3 a week",
    nameEl: "9 μήνες · 3 την εβδομάδα",
    credits: 108,
    priceCents: 103500,
    validityDays: 270,
    badge: null as string | null,
    sortOrder: 16,
    group: "nine" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "nine-4",
    nameEn: "9 months · Unlimited",
    nameEl: "9 μήνες · Unlimited",
    /* 270 days at six open days a week is 232 chances to walk
       in, so that is the ceiling — the same arithmetic as the quarter.
       `perDayLimit` is what makes it a plan rather than a bulk buy. */
    credits: 232,
    priceCents: 129500,
    validityDays: 270,
    badge: null as string | null,
    sortOrder: 17,
    group: "nine" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: 1 as number | null,
    seats: 1,
  },

  /* -------------------------------------------------------------- 12 months
     Twelve per cent off, and the cheapest class the studio sells: a year of
     Unlimited works out at EUR 5.36 a session if it is used as intended, which
     is why the BEST VALUE badge moved here off the three-month pack. It sat
     there truthfully until this row existed and would now be pointing at the
     second-best price on the page. */
  {
    slug: "year-1",
    nameEn: "12 months · 1 a week",
    nameEl: "12 μήνες · 1 την εβδομάδα",
    credits: 48,
    priceCents: 56500,
    validityDays: 360,
    badge: null as string | null,
    sortOrder: 18,
    group: "year" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "year-2",
    nameEn: "12 months · 2 a week",
    nameEl: "12 μήνες · 2 την εβδομάδα",
    credits: 96,
    priceCents: 95000,
    validityDays: 360,
    badge: null as string | null,
    sortOrder: 19,
    group: "year" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "year-3",
    nameEn: "12 months · 3 a week",
    nameEl: "12 μήνες · 3 την εβδομάδα",
    credits: 144,
    priceCents: 132000,
    validityDays: 360,
    badge: null as string | null,
    sortOrder: 20,
    group: "year" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "year-4",
    nameEn: "12 months · Unlimited",
    nameEl: "12 μήνες · Unlimited",
    /* 360 days at six open days a week is 309 chances to walk
       in, so that is the ceiling — the same arithmetic as the quarter.
       `perDayLimit` is what makes it a plan rather than a bulk buy. */
    credits: 309,
    priceCents: 165500,
    validityDays: 360,
    badge: null as string | null,
    sortOrder: 21,
    group: "year" as PackGroup,
    kind: "CLASS" as CreditKind,
    perDayLimit: 1 as number | null,
    seats: 1,
  },
  /* ------------------------------------------------- personal and duet
     A different thing from the plans above, sold in the same currency, and
     grouped on the price list with the day pass rather than alone at the foot
     of it.

     They belong there because all three are the same purchase: one session,
     thirty days, no commitment. The day pass buys a place in a class, a
     Personal buys the room, a Duet buys it for two — and a visitor deciding
     "I want to try one thing" is choosing between exactly those three. It also
     fixes a layout that had one lonely card under one heading and two under
     another.

     The old comment here worried that sitting near the plans would make a one
     to one look like a bad deal on price per session. That was right, and it is
     why they are not in the Monthly or 3 months rows. Next to the day pass the
     comparison is honest: EUR 20 for a class, EUR 30 for the room, EUR 22.50
     each for two.

     One reformer, one instructor, and the studio's midday hours: 12:00, 13:00
     and 14:00, weekdays. An appointment rather than a class, so it is booked by
     the end of the previous day — somebody has to be asked to come in and teach
     it — and the session that pays for it cannot pay for anything else.

     Thirty days rather than ninety, because these are bought for a reason that
     has a date on it: a return after an injury, a technique that is not working,
     a week before a wedding. A one to one still sitting in a balance in March
     was not what anybody meant to buy in January. */
  {
    slug: "personal",
    nameEn: "Personal · one to one",
    nameEl: "Ατομική · ένας προς έναν",
    credits: 1,
    priceCents: 3000,
    validityDays: 30,
    badge: null as string | null,
    sortOrder: 22,
    group: "personal" as PackGroup,
    kind: "PERSONAL" as CreditKind,
    perDayLimit: null as number | null,
    seats: 1,
  },
  {
    slug: "duet",
    nameEn: "Duet · for two",
    /* The product's Greek name, swept with the rest of the Greek copy. The
       English one stays "Duet" — it is the word the studio uses out loud. */
    nameEl: "Δυάδα · για δύο",
    /* One session, two people. Not two credits: two would let it be split
       across two solo appointments, which is not what €45 bought. */
    credits: 1,
    priceCents: 4500,
    validityDays: 30,
    badge: null as string | null,
    sortOrder: 23,
    group: "personal" as PackGroup,
    kind: "DUET" as CreditKind,
    perDayLimit: null as number | null,
    seats: 2,
  },
];

export type Pack = (typeof PACKS)[number];

export const OFFERED_PACK_SLUGS: ReadonlySet<string> = new Set(
  PACKS.map((p) => p.slug),
);

/**
 * Portrait for each instructor, keyed by the name the studio uses.
 *
 * A fallback, not an override: if a row in the database carries its own
 * photo_url that wins, so real photographs can be uploaded later without
 * touching this file. Until then the studio does not need to re-seed to see
 * faces on the team cards.
 */
export const INSTRUCTOR_PHOTOS: Record<string, string> = {
  "Maria K.": "/team/maria-k.jpg",
  "Andreas P.": "/team/andreas-p.jpg",
  "Elena S.": "/team/elena-s.jpg",
  "Chris M.": "/team/chris-m.jpg",
};

/** Which commitment a pack belongs to, by slug. */
const GROUP_BY_SLUG = new Map<string, PackGroup>(
  PACKS.map((p) => [p.slug, p.group]),
);

const PACK_BY_SLUG = new Map<string, Pack>(PACKS.map((p) => [p.slug, p]));

/**
 * The group for a slug.
 *
 * Read from this list rather than from a database column, because the grouping
 * is a fact about the price list and changes with it. A pack no longer on the
 * list has no group and is not shown anywhere that needs one.
 */
export function groupOf(slug: string): PackGroup {
  return GROUP_BY_SLUG.get(slug) ?? "month";
}

/** The pack itself, when a caller has only its slug. */
export function packBySlug(slug: string): Pack | undefined {
  return PACK_BY_SLUG.get(slug);
}

/** The two packs that buy an appointment rather than a place in a class. */
export const PERSONAL_PACK_SLUGS = PACKS.filter((p) => p.kind !== "CLASS").map(
  (p) => p.slug,
);
