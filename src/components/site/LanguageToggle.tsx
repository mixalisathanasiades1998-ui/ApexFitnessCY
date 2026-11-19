"use client";

import { useI18n } from "@/i18n/LanguageProvider";
import { DESK_LOCALES, LOCALE_LABEL, LOCALES } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * `tone="dark"` for use on the brown sections and in the footer.
 *
 * `desk` for the reception console, which is English and Greek only — Russian
 * is offered on the members' side of the site, not in the console.
 */
export function LanguageToggle({
  className,
  tone = "light",
  desk = false,
}: {
  className?: string;
  tone?: "light" | "dark";
  desk?: boolean;
}) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border p-0.5 text-[10px] uppercase tracking-widest",
        tone === "dark" ? "border-cream/25" : "border-mocha-200",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {(desk ? DESK_LOCALES : LOCALES).map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            onClick={() => setLocale(l)}
            aria-pressed={active}
            lang={l}
            className={cn(
              "rounded-full px-2.5 py-1 transition-all duration-500 ease-silk",
              active && tone === "dark" && "bg-cream text-mocha-700",
              active && tone === "light" && "bg-mocha-600 text-cream",
              !active && tone === "dark" && "text-cream/60 hover:text-cream",
              !active && tone === "light" && "text-clay hover:text-mocha-600",
            )}
          >
            {LOCALE_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
