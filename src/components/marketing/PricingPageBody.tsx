"use client";

import { ContactHelp } from "@/components/marketing/ContactHelp";
import { Faq } from "@/components/marketing/Faq";
import { PricingGrid, type PackageCard } from "@/components/marketing/PricingGrid";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHead } from "@/components/ui/Section";
import { useI18n } from "@/i18n/LanguageProvider";

export function PricingPageBody({
  packages,
  signedIn,
}: {
  packages: PackageCard[];
  signedIn: boolean;
}) {
  const { t } = useI18n();

  return (
    <>
      <Section className="pt-12 md:pt-16">
        <div className="container-x">
          <SectionHead
            eyebrow={t.pricingPage.eyebrow}
            title={t.pricingPage.title}
            body={t.pricingPage.body}
          />
          <Reveal>
            <ContactHelp className="mt-3 max-w-2xl" />
          </Reveal>
          <div className="mt-14">
            <PricingGrid packages={packages} signedIn={signedIn} />
          </div>
        </div>
      </Section>

      <Section tone="sand">
        <div className="container-x grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <SectionHead eyebrow={t.home.faq.eyebrow} title={t.home.faq.title} />
          <Faq />
        </div>
      </Section>
    </>
  );
}
