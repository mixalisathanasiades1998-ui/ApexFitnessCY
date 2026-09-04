/**
 * What the visitor said about cookies, and what saying it actually changes.
 *
 * ---
 *
 * **Why this file is short, and why that is the honest outcome.**
 *
 * A cookie banner is usually a switchboard for advertising and analytics
 * trackers. This site has none: no Google Analytics, no pixel, no tag manager,
 * no third-party script anywhere except Stripe's on the checkout page. So there
 * was a real temptation to build the familiar four-category dialog with
 * "Marketing" and "Statistics" toggles that control nothing, because that is
 * what a cookie banner looks like.
 *
 * That would be a lie told in a dialog whose entire purpose is honesty. The
 * categories below are the ones that exist, and each button does something you
 * could observe:
 *
 *   accept all    the language you pick is remembered between visits, and a
 *                 declined notification prompt stays declined on this device
 *   reject all    neither of those is written, and any copy of them already on
 *                 the device is removed
 *   customise     the two, separately
 *
 * The two necessary cookies are not offered, because they are not a choice: one
 * is how the site knows you are signed in and the other is the desk's lock. A
 * toggle that signs you out is not a privacy control.
 *
 * ---
 *
 * **Where the answer is kept.**
 *
 * In a cookie, which is the only place it can go: `localStorage` is per-origin
 * and would work, but the answer has to be readable by the server on the first
 * request so the notice is not painted and then removed on every page load.
 * Necessary by any definition, since without it the visitor is asked the same
 * question forever.
 *
 * The value is deliberately legible rather than a hash or a blob:
 * `v1:preferences=1` says what it means to anybody who opens their own cookie
 * jar to look, which is the sort of person who reads a page like this.
 */

export const CONSENT_COOKIE = "apex_consent";

/** A year, the same as the language cookie it governs. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The one optional category this site actually has.
 *
 * `preferences` covers the language cookie and the remembered "no thanks" on
 * the notification prompt. Both are conveniences stored on the visitor's own
 * device, neither is ever read by anybody but the visitor's own browser, and
 * neither is needed for anything to work.
 *
 * It is a record with one key rather than a boolean because the shape is the
 * part worth keeping: the day the studio adds something else optional, it is a
 * key here and a row in the dialog, not a rewrite of the consent format. The
 * version prefix on the cookie is what lets an older answer be re-asked if a
 * new category appears.
 */
export type Consent = {
  preferences: boolean;
};

export const CONSENT_ALL: Consent = { preferences: true };
export const CONSENT_NONE: Consent = { preferences: false };

/** The current format. Bump it and every visitor is asked again. */
const VERSION = "v1";

export function serialiseConsent(c: Consent) {
  return `${VERSION}:preferences=${c.preferences ? 1 : 0}`;
}

/**
 * Reads an answer back, and returns null for anything it does not recognise.
 *
 * Null means "has not answered", which is what shows the notice. An older
 * version, a truncated value or something somebody typed by hand all land in
 * the same place, and asking again is the safe direction: the alternative is
 * treating a value we cannot read as consent.
 */
export function parseConsent(raw: string | undefined | null): Consent | null {
  if (!raw) return null;
  const [version, ...rest] = raw.split(":");
  if (version !== VERSION) return null;
  const body = rest.join(":");
  const m = /preferences=([01])/.exec(body);
  if (!m) return null;
  return { preferences: m[1] === "1" };
}

/**
 * Has this visitor allowed the preference conveniences?
 *
 * Read from the browser's own cookie jar, because the two things it governs are
 * both written in the browser: the language cookie and the remembered "no
 * thanks" on the notification prompt.
 *
 * **Defaults to false while the question is unanswered**, and that direction
 * matters. A visitor who has not yet replied has not agreed to anything, so
 * nothing optional is written until they do. It makes the notice load-bearing
 * rather than decorative: refuse it, or ignore it, and the site genuinely does
 * not keep the preference.
 *
 * The cost is real and worth naming: somebody who switches to Greek and then
 * dismisses the notice without answering gets English again next visit. The
 * alternative is writing a cookie somebody has not agreed to, which is the
 * thing the notice exists to prevent.
 */
export function preferencesAllowed() {
  if (typeof document === "undefined") return false;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  return parseConsent(raw)?.preferences === true;
}
