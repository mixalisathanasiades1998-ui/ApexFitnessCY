"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/LanguageProvider";
import { LOCALE_COOKIE } from "@/i18n/dictionaries";
import {
  CONSENT_ALL,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  CONSENT_NONE,
  parseConsent,
  serialiseConsent,
  type Consent,
} from "@/lib/consent";

/**
 * The cookie notice: three buttons, each of which does something.
 *
 * ---
 *
 * **What "reject all" rejects.**
 *
 * On most sites that button turns off a dozen trackers. Here there are none, so
 * it does the only two things there are to do: it stops the language cookie
 * being written, and it clears the note that remembers you declined the
 * notification prompt. Both are conveniences on your own device; refusing them
 * costs you a site that opens in its default language.
 *
 * That is a smaller thing than the button usually means, and saying so is the
 * point. The notice tells you there is no advertising and no analytics here
 * before it asks, because a banner that implies twelve trackers and controls
 * none is worse than no banner.
 *
 * The two necessary cookies are named and not offered. One is how the site
 * knows you are signed in; the other is the desk's lock. A toggle that signs
 * somebody out is not a privacy control, and pretending it is optional would be
 * the same dishonesty in the other direction.
 *
 * ---
 *
 * **Why it does not appear and then vanish.**
 *
 * The answer arrives from the server on the first render, read from the cookie
 * in `layout.tsx`, so a visitor who has already answered never sees a flash of
 * the notice. Reading it in the browser instead would mean painting the bar on
 * every page load and removing it a frame later, which is exactly the
 * experience the cookie is supposed to prevent.
 *
 * `undefined` from the server means "not answered". A visitor who has answered
 * still gets the whole component mounted, with nothing rendered, so the footer
 * link can reopen it.
 */

function write(c: Consent) {
  document.cookie = `${CONSENT_COOKIE}=${serialiseConsent(
    c,
  )}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
}

/**
 * Clears what a refusal is refusing.
 *
 * Not writing a cookie in future is only half of it: somebody who accepted
 * last month and rejects today has one on their device already, and a refusal
 * that leaves it there has done nothing. Same for the notification snooze,
 * which lives in the browser's own storage rather than in a cookie.
 */
function forget() {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    window.localStorage.removeItem("apex_push_invite_dismissed");
  } catch {
    /* Storage can be switched off entirely, which is the same outcome. */
  }
}

export function CookieNotice({
  /** The saved answer, read from the cookie on the server. */
  initial,
}: {
  initial?: string;
}) {
  const { t } = useI18n();
  const c = t.cookies;

  const [answered, setAnswered] = useState(() => parseConsent(initial) !== null);
  const [open, setOpen] = useState(false);
  const [customising, setCustomising] = useState(false);
  const [prefs, setPrefs] = useState(
    () => parseConsent(initial)?.preferences ?? true,
  );

  /**
   * The footer link reopens it.
   *
   * Through a window event rather than shared state or a context, because the
   * footer is rendered on the server inside a layout two levels up and the two
   * components never meet. One event name, listened for here, dispatched there.
   */
  useEffect(() => {
    const reopen = () => {
      setCustomising(true);
      setOpen(true);
    };
    window.addEventListener("apex:cookie-settings", reopen);
    return () => window.removeEventListener("apex:cookie-settings", reopen);
  }, []);

  const decide = useCallback((next: Consent) => {
    write(next);
    if (!next.preferences) forget();
    setPrefs(next.preferences);
    setAnswered(true);
    setOpen(false);
    setCustomising(false);
  }, []);

  const showing = open || !answered;
  if (!showing) return null;

  return (
    <div
      data-cookie-notice
      role="region"
      aria-label={c.title}
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-mocha-200 bg-cream/95 backdrop-blur-md"
    >
      <div className="container-x py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="text-[13px] uppercase tracking-widest text-mocha-700">
              {c.title}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-mocha-500">
              {c.body}{" "}
              <Link
                href="/cookies"
                className="link-underline text-mocha-600"
                onClick={() => setOpen(false)}
              >
                {c.readMore}
              </Link>
            </p>

            {customising && (
              <div className="mt-4 space-y-2">
                {/* Necessary, stated and not offered. Listed first so the
                    shape of the answer is clear: this exists, you cannot turn
                    it off, and here is exactly what it does. */}
                <div className="rounded-2xl border border-mocha-200 bg-white/50 p-3">
                  <p className="flex items-center justify-between gap-4 text-[13px] text-mocha-700">
                    {c.necessary}
                    <span className="text-[10px] uppercase tracking-widest text-clay">
                      {c.always}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-clay">
                    {c.necessaryWhy}
                  </p>
                </div>

                <button
                  type="button"
                  data-consent-preferences
                  aria-pressed={prefs}
                  onClick={() => setPrefs((v) => !v)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-mocha-200 p-3 text-left transition-colors duration-300 hover:border-mocha-400"
                >
                  <span
                    aria-hidden
                    className={
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] " +
                      (prefs
                        ? "border-mocha-600 bg-mocha-600 text-cream"
                        : "border-mocha-300")
                    }
                  >
                    {prefs ? "✓" : ""}
                  </span>
                  <span className="flex-1">
                    <span className="text-[13px] text-mocha-700">
                      {c.preferences}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-clay">
                      {c.preferencesWhy}
                    </span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Accept, customise, reject. Accept is solid because it is the one
              most people want and hunting for it is its own small insult; the
              other two are given equal, quieter weight rather than reject
              being hidden, which is the trick this pattern is known for. */}
          <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
            {customising ? (
              <Button size="sm" onClick={() => decide({ preferences: prefs })}>
                {c.save}
              </Button>
            ) : (
              <Button size="sm" onClick={() => decide(CONSENT_ALL)}>
                {c.acceptAll}
              </Button>
            )}
            {!customising && (
              <Button
                size="sm"
                variant="outline"
                data-consent-customise
                onClick={() => setCustomising(true)}
              >
                {c.customise}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              data-consent-reject
              onClick={() => decide(CONSENT_NONE)}
            >
              {c.rejectAll}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The footer's way of reopening the notice.
 *
 * A button and not a link, because there is no page to go to: the choice is a
 * bar at the bottom of whatever the visitor is already reading. Styled to sit
 * in the footer's list of legal links without pretending to be one.
 */
export function CookieSettingsLink({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      data-cookie-settings
      onClick={() =>
        window.dispatchEvent(new Event("apex:cookie-settings"))
      }
      className={className}
    >
      {t.cookies.settings}
    </button>
  );
}
