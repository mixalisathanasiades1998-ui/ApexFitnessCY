"use client";

import { useI18n } from "@/i18n/LanguageProvider";
import { LANGUAGE_NAMES, type TeachingLanguage } from "@/lib/languages";
import { cn } from "@/lib/utils";

/**
 * Small flags for the languages an instructor teaches in.
 *
 * Drawn as SVG rather than flag emoji: Windows does not draw flag emoji at all
 * and shows two letters instead, which is most of the desktops the studio's
 * members book from. Each flag carries its language's name for screen readers
 * and as a tooltip on hover.
 */
function Flag({ lang }: { lang: TeachingLanguage }) {
  if (lang === "el") {
    return (
      <svg viewBox="0 0 27 18" aria-hidden>
        <rect width="27" height="18" fill="#0D5EAF" />
        {[1, 3, 5, 7].map((i) => (
          <rect key={i} y={i * 2} width="27" height="2" fill="#fff" />
        ))}
        <rect width="10" height="10" fill="#0D5EAF" />
        <rect x="4" width="2" height="10" fill="#fff" />
        <rect y="4" width="10" height="2" fill="#fff" />
      </svg>
    );
  }
  if (lang === "ru") {
    return (
      <svg viewBox="0 0 27 18" aria-hidden>
        <rect width="27" height="6" fill="#fff" />
        <rect y="6" width="27" height="6" fill="#0039A6" />
        <rect y="12" width="27" height="6" fill="#D52B1E" />
      </svg>
    );
  }
  /* English: the Union flag. */
  return (
    <svg viewBox="0 0 60 30" aria-hidden preserveAspectRatio="none">
      <clipPath id="uk-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-t)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

export function LanguageFlags({
  languages,
  className,
  size = "sm",
}: {
  languages: readonly TeachingLanguage[] | readonly string[];
  className?: string;
  size?: "sm" | "md";
}) {
  const { locale } = useI18n();
  const known = (languages as readonly string[]).filter(
    (l): l is TeachingLanguage => l === "el" || l === "en" || l === "ru",
  );
  if (known.length === 0) return null;
  const names = known
    .map((l) => (locale === "el" ? LANGUAGE_NAMES[l].el : LANGUAGE_NAMES[l].en))
    .join(", ");
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="img"
      aria-label={names}
      title={names}
    >
      {known.map((l) => (
        <span
          key={l}
          className={cn(
            "inline-block overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(91,70,69,0.15)]",
            size === "md" ? "h-[16px] w-[24px]" : "h-[13px] w-[19px]",
            "[&>svg]:block [&>svg]:h-full [&>svg]:w-full",
          )}
        >
          <Flag lang={l} />
        </span>
      ))}
    </span>
  );
}
