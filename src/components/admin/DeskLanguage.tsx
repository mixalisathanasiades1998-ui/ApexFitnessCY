"use client";

import type { ReactNode } from "react";
import { LanguageProvider, useI18n } from "@/i18n/LanguageProvider";
import { deskLocale } from "@/i18n/dictionaries";

/**
 * The console's own language: English or Greek, never Russian.
 *
 * Russian is a members' language (see DESK_LOCALES). The language cookie is
 * shared with the public site, so somebody who reads the site in Russian and
 * then opens /admin would otherwise get a console whose every word is English
 * anyway, under a switch that says RU. This puts the console in English for
 * them instead, with the console's own EN / ΕΛ switch; pressing either one sets
 * the cookie like any other switch.
 */
export function DeskLanguage({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  if (locale === deskLocale(locale)) return <>{children}</>;
  return (
    <LanguageProvider initialLocale={deskLocale(locale)}>
      {children}
    </LanguageProvider>
  );
}
