/**
 * The languages an instructor teaches in.
 *
 * Stored on the instructor as a short comma list ("el,en,ru"), edited from the
 * Team tab, and shown as small flags on the timetable and the studio page so a
 * member can see who teaches in their language before they book.
 */
export const TEACHING_LANGUAGES = ["el", "en", "ru"] as const;
export type TeachingLanguage = (typeof TEACHING_LANGUAGES)[number];

/** Every instructor teaches in Greek and English unless the desk says otherwise. */
export const DEFAULT_LANGUAGES: TeachingLanguage[] = ["el", "en"];

export const LANGUAGE_NAMES: Record<TeachingLanguage, { en: string; el: string; native: string }> = {
  el: { en: "Greek", el: "Ελληνικά", native: "Ελληνικά" },
  en: { en: "English", el: "Αγγλικά", native: "English" },
  ru: { en: "Russian", el: "Ρωσικά", native: "Русский" },
};

/** The stored list as known languages, in a fixed order, duplicates dropped. */
export function parseLanguages(raw: string | null | undefined): TeachingLanguage[] {
  if (raw == null) return [...DEFAULT_LANGUAGES];
  const set = new Set(
    raw
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );
  return TEACHING_LANGUAGES.filter((l) => set.has(l));
}

/** What the desk sent, cleaned to known languages; null when it is not a list. */
export function cleanLanguages(input: unknown): TeachingLanguage[] | null {
  if (!Array.isArray(input)) return null;
  const set = new Set(input.map((x) => String(x).trim().toLowerCase()));
  return TEACHING_LANGUAGES.filter((l) => set.has(l));
}

export function serializeLanguages(list: readonly TeachingLanguage[]): string {
  return list.join(",");
}
