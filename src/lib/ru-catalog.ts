/**
 * Russian for the words the studio types into the console.
 *
 * Class names, pack names, instructor bios and discount labels are written in
 * the console in English and Greek, and stored in the database in those two
 * columns. The console deliberately has no Russian fields: Russian is a
 * members' language, and asking the desk to keep a third copy of every name
 * would be a third copy that drifts.
 *
 * So the Russian is worked out here, from the English, at the moment it is
 * shown:
 *
 *   1. A known phrase (the catalogue as it stands) gets its translation.
 *   2. A pack name built the usual way — "3 months · 2 sessions per week",
 *      "10 classes" — is translated by its shape, so a new pack in the same
 *      pattern is Russian the day it is created.
 *   3. Anything else is shown in English, exactly as typed. A renamed class or
 *      a new bio is never shown with an old translation of a different text,
 *      because the lookup is by the English words themselves.
 *
 * Pure: imported by the browser and by the messaging code alike.
 */

/** Exact English → Russian. Matched after trimming, case-sensitively. */
const EXACT: Record<string, string> = {
  /* class types — the method names are kept as brand words, as the Greek
     site does, with the Russian only where the name is a description */
  "Reformer Foundations": "Reformer Foundations",
  "Reformer Flow": "Reformer Flow",
  "Reformer Sculpt": "Reformer Sculpt",
  "Jumpboard Cardio": "Jumpboard Cardio",
  "Stretch & Restore": "Stretch & Restore",
  "Athletic Reformer": "Athletic Reformer",
  "Personal or Duet": "Персональное или дуэт",
  "Reformer Group": "Групповое занятие на реформере",
  "Group class": "Групповое занятие",

  /* packs that are not built from the usual pattern */
  "Day pass": "Разовое посещение",
  "Personal · one to one": "Персональное · один на один",
  "Duet · for two": "Дуэт · для двоих",

  /* instructor bios */
  "Evelina teaches the early mornings, and she likes them unhurried and strong. Calm, precise and quietly demanding, she sets your springs and your pace so every class meets you exactly where you are.":
    "Эвелина ведёт ранние утренние занятия — неспешные и сильные. Спокойная, точная и требовательная без лишних слов, она подберёт пружины и темп так, чтобы каждое занятие подходило именно вам.",
  "Anna teaches with warmth and a sharp eye for form. First class or fiftieth, she finds the one cue that makes a movement click, and you leave with better posture than you walked in with.":
    "Анна преподаёт с теплом и зорко следит за техникой. Первое ли это занятие или пятидесятое — она найдёт ту единственную подсказку, после которой движение получается, и вы уйдёте с осанкой лучше, чем пришли.",
  "Stephani turns the fundamentals into something you look forward to. Steady, encouraging and full of energy, she builds the kind of control that carries off the reformer and into the rest of your week.":
    "Стефани превращает базовые упражнения в то, чего ждёшь с нетерпением. Уверенная, поддерживающая и полная энергии, она развивает контроль над телом, который остаётся с вами и после реформера — на всю неделю.",

  /* closure reasons the studio has used */
  "Summer Holiday": "Летние каникулы",
  "Summer holiday": "Летние каникулы",
  "Christmas": "Рождество",
  "Easter": "Пасха",
  "Public holiday": "Государственный праздник",

  /* discount labels the studio has used */
  "Welcome Offer": "Приветственное предложение",
  "Welcoming Offer": "Приветственное предложение",
  "Holidays Offer": "Праздничное предложение",
  "Offer": "Предложение",
};

/** 1 занятие · 2 занятия · 5 занятий — Russian needs three forms, not two. */
export function ruPlural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const sessions = (n: number) => ruPlural(n, "занятие", "занятия", "занятий");
const months = (n: number) => ruPlural(n, "месяц", "месяца", "месяцев");

/** Pack names built from the console's usual parts, translated by shape. */
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  /* "Intro · 3 classes" */
  [/^Intro · (\d+) (?:classes|sessions)$/, (m) => `Знакомство · ${m[1]} ${sessions(+m[1])}`],
  /* "10 classes" / "1 session" */
  [/^(\d+) (?:classes?|sessions?)$/, (m) => `${m[1]} ${sessions(+m[1])}`],
  /* "Monthly · 2 sessions per week" / "Monthly · Unlimited" */
  [
    /^Monthly · (\d+) (?:sessions?|classes?) (?:per|a) week$/,
    (m) => `Месячный · ${m[1]} ${sessions(+m[1])} в неделю`,
  ],
  [/^Monthly · Unlimited$/, () => "Месячный · Безлимит"],
  /* "3 months · 2 sessions per week" / "12 months · 2 a week" */
  [
    /^(\d+) months? · (\d+) (?:(?:sessions?|classes?) )?(?:per|a) week$/,
    (m) => `${m[1]} ${months(+m[1])} · ${m[2]} ${sessions(+m[2])} в неделю`,
  ],
  /* "6 months · Unlimited" */
  [/^(\d+) months? · Unlimited$/, (m) => `${m[1]} ${months(+m[1])} · Безлимит`],
  /* "-10% Discount", "-10€ Discount", "10% off" */
  [/^-?(\d+(?:[.,]\d+)?)\s?(%|€) (?:Discount|off)$/i, (m) => `Скидка ${m[1]}${m[2]}`],
  [/^(\d+(?:[.,]\d+)?)\s?(%|€) off$/i, (m) => `Скидка ${m[1]}${m[2]}`],
  /* "Mykonos Offer": a named offer keeps its name */
  [/^([^\s·]+) Offer$/, (m) => `Предложение «${m[1]}»`],
  /* "€10 off", the label the site writes itself for an amount */
  [/^€\s?(\d+(?:[.,]\d+)?) (?:off|Discount)$/i, (m) => `Скидка ${m[1]} €`],
];

/**
 * The Russian for an English phrase from the console, or the English itself.
 *
 * Never returns empty for a non-empty input: the worst case is the English
 * words, which is what a Russian reader saw of these names before.
 */
export function ruText(english: string | null | undefined): string {
  const s = (english ?? "").trim();
  if (!s) return english ?? "";
  const exact = EXACT[s];
  if (exact) return exact;
  for (const [re, make] of PATTERNS) {
    const m = s.match(re);
    if (m) return make(m);
  }
  return english ?? "";
}

/**
 * A name stored as English and Greek, read in any of the three languages.
 *
 * Greek falls back to English when the console left it empty, as it always has.
 */
export function pickText(
  locale: string,
  en: string | null | undefined,
  el?: string | null,
): string {
  if (locale === "el") return (el && el.trim()) || en || "";
  if (locale === "ru") return ruText(en);
  return en ?? "";
}
