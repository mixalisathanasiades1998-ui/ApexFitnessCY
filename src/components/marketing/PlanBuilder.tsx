"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import type { PackageCard } from "@/components/marketing/PricingGrid";

/**
 * One card that builds any plan, instead of twenty cards showing them all.
 *
 * ---
 *
 * **Why this replaced the grid.**
 *
 * Five terms times four frequencies is twenty plans, and the honest way to show
 * twenty cards is not to. The page reached 23 cards and fourteen thousand pixels
 * on a phone — sixteen screens of near-identical rectangles differing by a
 * number — and the studio said so.
 *
 * The choice was never twenty things. It is two questions: how long am I
 * committing for, and how often do I train. So the card asks those two and shows
 * the one answer. Every combination is still a real pack, still bought through
 * the same checkout; this is a way of *choosing* one, not a new kind of product.
 *
 * ---
 *
 * **It resolves to a pack rather than computing a price.**
 *
 * `slugFor` builds the slug — `quarter-2`, `year-4` — and looks it up in the
 * catalogue the server sent. Nothing here multiplies or discounts anything.
 *
 * That matters more than it looks. A builder that did its own arithmetic would
 * be a second pricing engine, and the moment the studio ran an offer through the
 * desk the card and the checkout would disagree about what something costs. The
 * price shown here is the priced pack, offer included, because it *is* the pack.
 * A combination with no pack behind it simply does not offer itself.
 */

/** The five terms, in the order somebody thinks about them. */
const TERMS = [
  { months: 1, group: "month" },
  { months: 3, group: "quarter" },
  { months: 6, group: "half" },
  { months: 9, group: "nine" },
  { months: 12, group: "year" },
] as const;

/**
 * The four cadences — and the fourth one is not called the same thing in every
 * term, which is a trap worth spelling out.
 *
 * `quarter-4` is "3 months · Unlimited", with a one-a-day cap and 78 sessions.
 * `month-4` is "Monthly · 4 a week", with 16 sessions and no cap. Same `-4`,
 * two different products.
 *
 * The first version of this card labelled the fourth chip "Unlimited" flatly,
 * which meant choosing *1 month + Unlimited* offered EUR 180 for a plan that is
 * four a week and not unlimited at all. Caught by walking all twenty
 * combinations and reading the prices back.
 *
 * So the label is taken from the pack it resolves to: a plan that carries a
 * `perDayLimit` is the unlimited kind, and anything else is counted per week.
 * The pack knows; this card should not be guessing.
 */
const CADENCES = [1, 2, 3, 4] as const;

function slugFor(months: number, cadence: number) {
  const term = TERMS.find((x) => x.months === months);
  return term ? `${term.group}-${cadence}` : null;
}

export function PlanBuilder({
  packages,
  signedIn,
}: {
  packages: PackageCard[];
  signedIn: boolean;
}) {
  const { t, locale, fmtMoney } = useI18n();
  const router = useRouter();
  const el = locale === "el";
  const d = t.pricingPage.builder;

  /**
   * Opens on three months, twice a week.
   *
   * Not the cheapest and not the longest: the one the studio sells most, and the
   * combination somebody arriving at a pricing page is most likely to be
   * weighing up. An opening state of "1 month, 1 a week" would show the
   * least attractive plan the studio has as its first impression.
   */
  const [months, setMonths] = useState(3);
  const [cadence, setCadence] = useState(2);
  const [busy, setBusy] = useState(false);

  const slug = slugFor(months, cadence);
  const pack = slug ? packages.find((p) => p.slug === slug) : undefined;

  function buy() {
    if (!pack) return;
    const next = `/checkout?pack=${pack.slug}`;
    setBusy(true);
    router.push(
      signedIn
        ? next
        : `/login?next=${encodeURIComponent(next)}&pkg=${pack.slug}`,
    );
  }

  const unitCents = pack ? Math.round(pack.priceCents / pack.credits) : 0;
  const badge =
    pack?.badge === "POPULAR"
      ? t.pricingPage.popular
      : pack?.badge === "BEST_VALUE"
        ? t.pricingPage.bestValue
        : null;

  /** One row of choices. Chips, the same as everywhere else on the site. */
  function Row({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) {
    return (
      <div>
        <p className="eyebrow mb-3 text-clay">{label}</p>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    );
  }

  function Chip({
    on,
    onClick,
    children,
  }: {
    on: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className={cn(
          "rounded-full border px-4 py-2 text-[11px] uppercase tracking-widest transition-all duration-500",
          on
            ? "border-mocha-600 bg-mocha-600 text-cream"
            : "border-mocha-300 text-mocha-500 hover:border-mocha-500 hover:bg-white",
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <article className="relative rounded-3xl border border-mocha-200/70 bg-white/60 p-8 sm:p-10">
      {badge && (
        <span className="absolute -top-3 left-8 rounded-full bg-mocha-600 px-4 py-1 text-[10px] uppercase tracking-widest text-cream">
          {badge}
        </span>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:gap-14">
        {/* The two questions */}
        <div className="space-y-7">
          <Row label={d.howLong}>
            {TERMS.map((term) => (
              <Chip
                key={term.months}
                on={months === term.months}
                onClick={() => setMonths(term.months)}
              >
                {term.months === 1
                  ? d.oneMonth
                  : d.months.replace("{n}", String(term.months))}
              </Chip>
            ))}
          </Row>

          <Row label={d.howOften}>
            {CADENCES.map((n) => {
              /* What this chip would actually buy at the selected term, so the
                 fourth one reads "Unlimited" on a quarter and "4 a week" on a
                 month. See the note on CADENCES. */
              const forThisTerm = packages.find(
                (x) => x.slug === slugFor(months, n),
              );
              return (
                <Chip key={n} on={cadence === n} onClick={() => setCadence(n)}>
                  {forThisTerm?.perDayLimit
                    ? d.unlimited
                    : d.perWeek.replace("{n}", String(n))}
                </Chip>
              );
            })}
          </Row>

          <p className="max-w-md text-[13px] leading-relaxed text-clay">
            {d.note}
          </p>
        </div>

        {/**
         * The answer.
         *
         * `lg:min-w-[260px]` so the panel does not resize as the numbers change
         * width — a price going from EUR 950 to EUR 1,655 would otherwise shift
         * the whole card, and a layout that jumps while you are comparing two
         * options is worse than one that wastes forty pixels.
         */}
        <div className="lg:min-w-[260px] lg:border-l lg:border-mocha-200/70 lg:pl-14">
          {pack ? (
            <>
              <p className="eyebrow text-clay">
                {el ? pack.nameEl : pack.nameEn}
              </p>
              <p className="mt-3 font-display text-5xl text-mocha-600">
                {fmtMoney(pack.priceCents)}
              </p>
              {pack.listPriceCents && pack.listPriceCents > pack.priceCents ? (
                <p className="mt-1 text-[13px] text-clay">
                  <span className="line-through">
                    {fmtMoney(pack.listPriceCents)}
                  </span>{" "}
                  {(el ? pack.discountLabelEl : pack.discountLabelEn) ||
                    t.pricingPage.offer}
                </p>
              ) : null}
              <p className="mt-2 text-[12px] text-mocha-500">
                {fmtMoney(unitCents)} {t.pricingPage.perClassLabel}
              </p>

              <div className="mt-7 space-y-3 border-t border-mocha-200/70 pt-6 text-[13px] text-mocha-500">
                <p className="flex items-center justify-between gap-6">
                  <span>{t.common.credits}</span>
                  <span className="font-display text-xl text-mocha-600">
                    {pack.credits}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-6">
                  <span>{t.pricingPage.validity}</span>
                  <span>
                    {pack.validityDays} {t.pricingPage.days}
                  </span>
                </p>
                {pack.perDayLimit ? (
                  <p className="flex items-center justify-between gap-6">
                    <span>{t.pricingPage.paceLabel}</span>
                    <span>{t.pricingPage.onePerDay}</span>
                  </p>
                ) : null}
              </div>

              <Button
                onClick={buy}
                disabled={busy}
                className="mt-7 w-full"
                aria-label={`${d.buy} — ${el ? pack.nameEl : pack.nameEn}`}
              >
                {busy ? t.common.loading : d.buy}
              </Button>
            </>
          ) : (
            /* No pack for this pair. Should not happen with the catalogue as it
               stands, and says so plainly rather than rendering an empty panel
               if a pack is ever withdrawn. */
            <p className="text-[13px] text-clay">{d.unavailable}</p>
          )}
        </div>
      </div>
    </article>
  );
}
