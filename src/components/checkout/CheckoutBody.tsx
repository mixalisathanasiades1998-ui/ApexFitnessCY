"use client";

import { ContactHelp } from "@/components/marketing/ContactHelp";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Monogram } from "@/components/ui/Monogram";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { TestCardForm } from "@/components/checkout/TestCardForm";
import { useI18n } from "@/i18n/LanguageProvider";
import { STUDIO } from "@/lib/studio";

/* Stripe's SDK is a couple of hundred kilobytes. It is fetched when a member
   reaches a card form and never as part of any other page. */
const StripeFields = dynamic(
  () => import("@/components/checkout/StripeFields"),
  { ssr: false },
);

type Pack = {
  id: string;
  slug: string;
  nameEn: string;
  nameEl: string;
  credits: number;
  priceCents: number;
  validityDays: number;
};

type Started =
  | { mode: "fields"; clientSecret: string; publicKey: string; purchaseId: string }
  | {
      mode: "redirect";
      url: string;
      purchaseId: string;
      post?: { action: string; fields: Record<string, string> };
    }
  | { mode: "test"; purchaseId: string };

/**
 * The page where money changes hands.
 *
 * It is deliberately two things side by side and nothing else: what you are
 * buying, and how you are paying. No navigation temptations, no upsells, no
 * second decision to make. The summary stays visible while the card is filled
 * in, because the one question anybody asks at this moment is "how much is this
 * again".
 *
 * The payment half is a slot. Which provider fills it is decided on the server
 * (see src/lib/payments), so this component asks "what should I show" once and
 * renders one of three things: the provider's own card fields, a handover to
 * the provider's page, or the test form used until credentials arrive.
 */
/** The start-day choice, as the server worked it out. */
type StartChoice = {
  startsOn: string;
  reason: "TODAY" | "AFTER_PACK" | "AFTER_LAST_BOOKING";
  current: { sessionsLeft: number; endsOn: string } | null;
  lastBookedOn: string | null;
  min: string;
  max: string;
};

/** A day key moved by whole days. Noon UTC, so no timezone can tip it over. */
function addDayKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CheckoutBody({
  pack,
  member,
  balance,
  payment,
  start,
}: {
  pack: Pack;
  member: { name: string; email: string };
  balance: number;
  payment: { id: string | null; label: string | null; configured: boolean };
  start: StartChoice;
}) {
  const { t, locale, fmtMoney, fmtSessions, fmtFullDate } = useI18n();
  const c = t.checkoutPage;
  const el = locale === "el";
  const router = useRouter();

  const [started, setStarted] = useState<Started | null>(null);
  /* Read by `open`, which is memoised: the start day it sends must be the one
     on screen, not the one from when the callback was made. */
  const startRef = useRef(start.startsOn);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  /* What is actually being charged, which a discount code can move. Starts at
     the pack's live price and follows the server's answer. */
  const [amountCents, setAmountCents] = useState(pack.priceCents);
  const [promo, setPromo] = useState<{
    code: string;
    discountCents: number;
  } | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  /* The start day. Preselected with the server's suggestion; the member can
     change it, and the open payment is updated to carry the new day. */
  const [startsOn, setStartsOn] = useState(start.startsOn);
  const [savingStart, setSavingStart] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  /* The same rule as the server: N days from the start day. */
  const endsOn = addDayKey(startsOn, pack.validityDays);
  const startsToday = startsOn <= start.min;
  /* A pack of this kind is running: the new one tops it up. Its days are
     counted from the chosen day, but its sessions can be booked now. */
  const topUp = start.current !== null;
  const day = (key: string) => fmtFullDate(`${key}T12:00:00Z`);

  const name = el ? pack.nameEl : pack.nameEn;
  const amountLabel = fmtMoney(amountCents);

  /**
   * Open a payment for this pack, optionally with a code.
   *
   * Applying or clearing a code opens a fresh payment — a new PENDING purchase
   * at the new amount — and the previous one is simply abandoned, exactly as it
   * would be if the member reloaded the page. Returns whether it opened, so the
   * code box can tell an invalid code from a provider problem.
   */
  const open = useCallback(
    async (code?: string): Promise<boolean> => {
      setError(null);
      setCodeError(null);
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packSlug: pack.slug,
            ...(code ? { code } : {}),
            startsOn: startRef.current,
          }),
        });
        const data = (await res.json()) as Record<string, unknown> & {
          error?: string;
          amountCents?: number;
          promo?: { code: string; discountCents: number } | null;
        };

        if (data.error) {
          if (code && data.error === "PROMO_INVALID") {
            setCodeError(c.codeInvalid);
            return false;
          }
          setError(
            data.error === "PAYMENTS_NOT_CONFIGURED"
              ? c.errNotConfigured
              : /* The page was opened before midnight and the day on it has
                   since passed, or another pack was bought on another tab:
                   the dates on screen are out of date, not the card. */
                data.error === "BAD_START"
                ? c.startStale
                : c.errProvider,
          );
          return false;
        }
        setStarted(data as unknown as Started);
        /* The day may have been changed while this payment was opening. If the
           server recorded a different one, send the day on screen now. */
        const opened = data as { purchaseId?: string; startsOn?: string };
        if (
          opened.purchaseId &&
          opened.startsOn &&
          opened.startsOn !== startRef.current
        ) {
          /* Covered while it saves, like any other change of day, and if it is
             refused the screen goes back to the day the payment really carries
             — what is shown must be what is charged for. */
          const wanted = startRef.current;
          setSavingStart(true);
          let saved = false;
          try {
            const r = await fetch("/api/checkout/start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                purchaseId: opened.purchaseId,
                startsOn: wanted,
              }),
            });
            saved = r.ok;
          } catch {
            saved = false;
          } finally {
            setSavingStart(false);
          }
          if (!saved && startRef.current === wanted) {
            startRef.current = opened.startsOn;
            setStartsOn(opened.startsOn);
            setStartError(c.startBad);
          }
        }
        if (typeof data.amountCents === "number") setAmountCents(data.amountCents);
        setPromo(data.promo ?? null);
        return true;
      } catch {
        setError(c.errProvider);
        return false;
      }
    },
    [pack.slug, c.errNotConfigured, c.errProvider, c.codeInvalid, c.startBad, c.startStale],
  );

  /**
   * Change the start day on the payment that is already open.
   *
   * The amount does not change, so no new payment is needed: the server just
   * writes the new day on this one. The payment area is covered while it saves,
   * so nobody can pay in the half second between choosing a day and the day
   * being recorded.
   */
  async function changeStart(next: string) {
    if (!next || next === startsOn) return;
    const previous = startsOn;
    setStartsOn(next);
    startRef.current = next;
    setStartError(null);
    if (!started) return;
    setSavingStart(true);
    try {
      const res = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: started.purchaseId, startsOn: next }),
      });
      if (!res.ok) {
        setStartsOn(previous);
        startRef.current = previous;
        setStartError(c.startBad);
      }
    } catch {
      setStartsOn(previous);
      startRef.current = previous;
      setStartError(c.startBad);
    } finally {
      setSavingStart(false);
    }
  }

  /* One payment per visit to this page. The guard matters in development, where
     effects run twice and would otherwise open two payments for one member. */
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void open();
  }, [open]);

  async function applyCode() {
    if (!codeInput.trim() || applying) return;
    setApplying(true);
    try {
      await open(codeInput.trim());
    } finally {
      setApplying(false);
    }
  }

  async function removeCode() {
    setCodeInput("");
    setApplying(true);
    try {
      await open();
    } finally {
      setApplying(false);
    }
  }

  /* Ask our own server to confirm with the provider, then move on. The page we
     land on refreshes the layout, which is what updates the count in the
     header. */
  const finish = useCallback(
    async (purchaseId: string) => {
      setSettling(true);
      try {
        await fetch("/api/payments/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchaseId }),
        });
      } catch {
        /* Not fatal: the webhook and the success page both pick this up. */
      }
      router.push(`/checkout/success?p=${purchaseId}`);
    },
    [router],
  );

  /* A gateway that only accepts a form POST gets a hidden form, submitted as
     soon as the member presses the button. */
  const postForm = useRef<HTMLFormElement>(null);

  return (
    <Section className="pt-12 md:pt-16">
      <div className="container-x">
        <Reveal>
          <p className="eyebrow mb-4">{c.eyebrow}</p>
          <h1 className="h-display text-[2.4rem] leading-[1.05] sm:text-5xl">
            {c.title}
          </h1>
          <ContactHelp className="mt-5 max-w-2xl" />
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          {/* ------------------------------------------------ what you are buying */}
          <Reveal>
            <div className="rounded-4xl border border-mocha-200/70 bg-white/70 p-8 backdrop-blur-sm md:p-10 lg:sticky lg:top-28">
              <p className="text-[10px] uppercase tracking-brand text-clay">
                {c.orderTitle}
              </p>

              <div className="mt-7 flex items-baseline justify-between gap-6">
                <div>
                  <p className="font-display text-3xl text-mocha-600">{name}</p>
                  <p className="mt-2 text-[13px] text-clay">
                    {fmtSessions(pack.credits)} ·{" "}
                    {fmtMoney(Math.round(pack.priceCents / pack.credits))}{" "}
                    {c.perClassNote}
                  </p>
                </div>
                <p className="shrink-0 font-display text-3xl lining-nums tabular-nums text-mocha-600">
                  {amountLabel}
                </p>
              </div>

              {/* When the pack starts. Above the details, because it changes
                  what the details mean: which days these sessions can book. */}
              <div className="mt-8 border-t border-mocha-200/70 pt-6">
                <label className="label" htmlFor="pack-start">
                  {c.startTitle}
                </label>
                <DateField
                  id="pack-start"
                  value={startsOn}
                  min={start.min}
                  max={start.max}
                  onChange={(v) => void changeStart(v)}
                />
                <p className="mt-3 text-[14px] leading-relaxed text-mocha-600">
                  {startsToday
                    ? c.startToday.replace("{end}", day(endsOn))
                    : topUp
                      ? c.startTopUp
                          .replace("{days}", String(pack.validityDays))
                          .replace("{start}", day(startsOn))
                          .replace("{end}", day(endsOn))
                      : c.startLater
                          .replaceAll("{start}", day(startsOn))
                          .replace("{end}", day(endsOn))}
                </p>
                {start.reason === "AFTER_PACK" &&
                  start.current &&
                  startsOn === start.startsOn && (
                    <p className="mt-2 text-[12px] leading-relaxed text-clay">
                      {start.current.sessionsLeft > 0
                        ? c.startWhyAfterPack
                            .replace("{date}", day(start.startsOn))
                            .replace("{n}", fmtSessions(start.current.sessionsLeft))
                            .replace("{end}", day(start.current.endsOn))
                        : c.startWhyRunsUntil
                            .replace("{date}", day(start.startsOn))
                            .replace("{days}", String(pack.validityDays))}
                    </p>
                  )}
                {start.reason === "AFTER_LAST_BOOKING" &&
                  start.lastBookedOn &&
                  startsOn === start.startsOn && (
                    <p className="mt-2 text-[12px] leading-relaxed text-clay">
                      {c.startWhyAfterBooking
                        .replace("{date}", day(start.startsOn))
                        .replace("{last}", day(start.lastBookedOn))}
                    </p>
                  )}
                {/* Choosing a day while sessions are still running on the old
                    pack is allowed, but it is worth knowing what it means. */}
                {start.current && startsOn <= start.current.endsOn && (
                  <p className="mt-3 rounded-2xl border border-gold/40 bg-[#FBF6E7] px-4 py-3 text-[12px] leading-relaxed text-mocha-700">
                    {c.startOverlap.replace("{end}", day(start.current.endsOn))}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-clay">
                  {c.startRange.replace("{max}", day(start.max))}
                </p>
                {startError && (
                  <p className="mt-2 text-[12px] text-red-700">{startError}</p>
                )}
              </div>

              <dl className="mt-8 space-y-3 border-t border-mocha-200/70 pt-6 text-[13px]">
                <Row
                  k={t.home.hero.stat2}
                  v={`${STUDIO.classLengthMinutes} min`}
                />
                <Row
                  k={c.validityLabel}
                  v={c.validityValue.replace("{n}", String(pack.validityDays))}
                />
                <Row k={topUp ? c.countRow : c.startRow} v={day(startsOn)} />
                <Row k={c.endRow} v={day(endsOn)} strong />
                <Row k={c.balanceNow} v={fmtSessions(balance)} />
                <Row
                  k={c.afterPurchase}
                  v={fmtSessions(balance + pack.credits)}
                  strong
                />
              </dl>

              <div className="mt-8 flex items-baseline justify-between gap-4 border-t border-mocha-200/70 pt-6">
                <span className="text-[11px] uppercase tracking-widest text-mocha-600">
                  {c.total}
                </span>
                <span className="text-right">
                  {promo && (
                    <span className="mr-2 align-middle text-[15px] text-clay line-through lining-nums tabular-nums">
                      {fmtMoney(pack.priceCents)}
                    </span>
                  )}
                  <span className="align-middle font-display text-4xl lining-nums tabular-nums text-mocha-600">
                    {amountLabel}
                  </span>
                  <span className="mt-1 block text-[11px] text-clay">
                    {c.vat}
                  </span>
                </span>
              </div>

              {/* Discount code. Applying it re-opens the payment at the new
                  amount; the chip shows what came off. */}
              <div className="mt-6 border-t border-mocha-200/70 pt-6">
                {promo ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1.5 text-[11px] uppercase tracking-widest text-[#8a6f1a]">
                      <span className="font-mono">{promo.code}</span>
                      <span>-{fmtMoney(promo.discountCents)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeCode()}
                      disabled={applying}
                      className="link-underline text-[11px] uppercase tracking-widest text-clay"
                    >
                      {c.codeRemove}
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="label" htmlFor="promo-code">
                      {c.codeLabel}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="promo-code"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void applyCode();
                          }
                        }}
                        className="input uppercase"
                        autoComplete="off"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={applying || !codeInput.trim()}
                        onClick={() => void applyCode()}
                      >
                        {applying ? t.common.loading : c.codeApply}
                      </Button>
                    </div>
                    {codeError && (
                      <p className="mt-2 text-[12px] text-red-700">{codeError}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between gap-4">
                <Link
                  href="/pricing"
                  className="link-underline text-[11px] uppercase tracking-widest text-clay"
                >
                  {c.changePack}
                </Link>
                <Monogram className="h-7 w-7 text-clay/40" />
              </div>
            </div>
          </Reveal>

          {/* ------------------------------------------------------- how you pay */}
          {/* No reveal animation on this half. Everything else on the site fades
              in as you scroll to it, but a card form that is invisible until an
              observer fires is not a risk worth taking for a flourish. */}
          <div>
            <div className="rounded-4xl border border-mocha-200/70 bg-cream p-8 md:p-10">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[10px] uppercase tracking-brand text-clay">
                  {c.payTitle}
                </p>
                {/* Whose account is being topped up. Truncated rather than
                    wrapped: a long address should not push the panel about. */}
                <p
                  title={member.email}
                  className="max-w-[55%] truncate text-[11px] text-clay"
                >
                  {member.email}
                </p>
              </div>

              <div
                className={`relative mt-8 ${savingStart ? "pointer-events-none" : ""}`}
                aria-busy={savingStart}
              >
                {savingStart && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-cream/80 text-sm text-clay">
                    {c.startSaving}
                  </div>
                )}
                {error && (
                  <p
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                {!error && !started && (
                  <p className="py-10 text-center text-sm text-clay">
                    {t.common.loading}
                  </p>
                )}

                {started?.mode === "fields" && (
                  <StripeFields
                    key={started.clientSecret}
                    publicKey={started.publicKey}
                    clientSecret={started.clientSecret}
                    returnUrl={`${window.location.origin}/checkout/success?p=${started.purchaseId}`}
                    amountLabel={amountLabel}
                    /* Already known and already signed in, so the card form
                       does not ask for it a second time. */
                    email={member.email}
                    onPaid={() => void finish(started.purchaseId)}
                  />
                )}

                {started?.mode === "test" && (
                  <TestCardForm
                    amountLabel={amountLabel}
                    onPaid={() => finish(started.purchaseId)}
                  />
                )}

                {started?.mode === "redirect" && (
                  <div>
                    <p className="text-[15px] leading-relaxed text-mocha-600">
                      {c.redirectTitle.replace(
                        "{provider}",
                        payment.label ?? "",
                      )}
                    </p>
                    <p className="mt-3 text-sm text-clay">{c.redirectBody}</p>

                    {started.post ? (
                      <>
                        <form
                          ref={postForm}
                          action={started.post.action}
                          method="POST"
                          className="hidden"
                        >
                          {Object.entries(started.post.fields).map(([k, v]) => (
                            <input key={k} type="hidden" name={k} value={v} />
                          ))}
                        </form>
                        <Button
                          size="lg"
                          className="mt-8 w-full"
                          onClick={() => postForm.current?.submit()}
                        >
                          {c.redirectButton.replace(
                            "{provider}",
                            payment.label ?? "",
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="lg"
                        className="mt-8 w-full"
                        onClick={() => {
                          window.location.href = started.url;
                        }}
                      >
                        {c.redirectButton.replace(
                          "{provider}",
                          payment.label ?? "",
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {settling && (
                  <p className="mt-6 text-center text-sm text-clay">
                    {c.paying}
                  </p>
                )}
              </div>

              <p className="mt-8 flex items-start gap-3 border-t border-mocha-200/70 pt-6 text-[12px] leading-relaxed text-clay">
                <Lock />
                {payment.label && payment.id !== "test"
                  ? c.secure.replace("{provider}", payment.label)
                  : c.secureGeneric}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="text-clay">{k}</dt>
      <dd
        className={
          strong
            ? "lining-nums tabular-nums text-mocha-600"
            : "lining-nums tabular-nums text-mocha-500"
        }
      >
        {v}
      </dd>
    </div>
  );
}

function Lock() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="mt-px h-4 w-4 shrink-0 text-clay/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}
