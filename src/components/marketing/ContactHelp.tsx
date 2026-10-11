"use client";

import { useI18n } from "@/i18n/LanguageProvider";
import { STUDIO } from "@/lib/studio";
import { cn } from "@/lib/utils";

/**
 * "If you have any issue, contact us at +357 99 649 052."
 *
 * One line, shared by the pricing page and every checkout, so the wording and
 * the number cannot drift apart. The number is read from STUDIO, like the
 * footer and the contact page, and dials when tapped; `tel:` will not accept
 * the spaces it is written with, so they are stripped for the link only.
 */
export function ContactHelp({ className }: { className?: string }) {
  const { t } = useI18n();
  const [before, after = ""] = t.common.contactHelp.split("{phone}");
  return (
    <p className={cn("text-[15px] leading-relaxed text-mocha-500", className)}>
      {before}
      <a
        href={`tel:${STUDIO.phone.replace(/\s/g, "")}`}
        className="whitespace-nowrap font-semibold text-mocha-700 underline-offset-4 hover:underline"
      >
        {STUDIO.phone}
      </a>
      {after}
    </p>
  );
}
