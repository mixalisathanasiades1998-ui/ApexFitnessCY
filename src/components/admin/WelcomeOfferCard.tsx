"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/LanguageProvider";
import { STUDIO } from "@/lib/studio";

/**
 * The welcome offer, on the Pricing tab.
 *
 * One switch and four numbers. The sentence under the heading says, in words,
 * what is live right now — read back from the server after every save, so the
 * owner sees what the site will actually do rather than what they typed.
 */

type Settings = {
  enabled: boolean;
  credits: number;
  validityDays: number;
  grantFrom: string;
  grantUntil: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  serverOff: boolean;
};

/** An instant as the studio's calendar day, "YYYY-MM-DD". */
function studioDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function WelcomeOfferCard({
  onNotice,
  panel,
  heading,
}: {
  onNotice: (s: string) => void;
  panel: string;
  heading: string;
}) {
  const { t, fmtFullDate } = useI18n();
  const d = t.desk;

  const [live, setLive] = useState<Settings | null>(null);
  const [form, setForm] = useState({
    enabled: true,
    credits: "1",
    validityDays: "30",
    grantFrom: "",
    grantUntil: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adopt = useCallback((s: Settings) => {
    setLive(s);
    setForm({
      enabled: s.enabled,
      credits: String(s.credits),
      validityDays: String(s.validityDays),
      grantFrom: studioDay(s.grantFrom),
      grantUntil: s.grantUntil ? studioDay(s.grantUntil) : "",
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/welcome");
        if (!res.ok || !alive) return;
        const data = (await res.json()) as Settings;
        if (alive) adopt(data);
      } catch {
        /* The card stays empty; the rest of the tab still works. */
      }
    })();
    return () => {
      alive = false;
    };
  }, [adopt]);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          credits: Number(form.credits),
          validityDays: Number(form.validityDays),
          grantFrom: form.grantFrom,
          grantUntil: form.grantUntil || null,
        }),
      });
      const data = (await res.json()) as Settings & { error?: string };
      if (!res.ok) {
        setError(
          data.error === "BAD_CREDITS"
            ? d.welcomeBadCredits
            : data.error === "BAD_DAYS"
              ? d.welcomeBadDays
              : data.error === "BAD_DATES" || data.error === "BAD_REQUEST"
                ? d.welcomeBadDates
                : d.packForbidden,
        );
        return;
      }
      adopt(data);
      onNotice(d.welcomeSaved);
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  const summary = !live
    ? ""
    : live.enabled
      ? d.welcomeLive
          .replace("{from}", fmtFullDate(live.grantFrom))
          .replace(
            "{until}",
            live.grantUntil
              ? d.welcomeLiveUntil.replace("{until}", fmtFullDate(live.grantUntil))
              : "",
          )
          .replace("{n}", String(live.credits))
          .replace("{days}", String(live.validityDays))
      : d.welcomeOff;

  return (
    <div className={panel} data-desk-panel="welcome">
      <p className={heading}>{d.welcomeTitle}</p>
      <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-clay">
        {d.welcomeHelp}
      </p>

      {live && (
        <p
          className={`mt-4 max-w-2xl rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
            live.enabled && !live.serverOff
              ? "bg-mocha-100/70 text-mocha-700"
              : "bg-sand/70 text-mocha-500"
          }`}
        >
          {summary}
        </p>
      )}
      {live?.serverOff && (
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-red-700">
          {d.welcomeServerOff}
        </p>
      )}

      <label className="mt-6 flex items-center gap-3 text-[14px] text-mocha-600">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          className="h-4 w-4 accent-mocha-600"
        />
        {d.welcomeEnabled}
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="label">{d.welcomeCredits}</span>
          <input
            className="input lining-nums tabular-nums"
            type="number"
            min={1}
            max={5}
            value={form.credits}
            onChange={(e) => setForm({ ...form, credits: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">{d.welcomeDays}</span>
          <input
            className="input lining-nums tabular-nums"
            type="number"
            min={1}
            max={365}
            value={form.validityDays}
            onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">{d.welcomeFrom}</span>
          <input
            type="date"
            className="input"
            value={form.grantFrom}
            onChange={(e) => setForm({ ...form, grantFrom: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">{d.welcomeUntil}</span>
          <input
            type="date"
            className="input"
            value={form.grantUntil}
            min={form.grantFrom || undefined}
            onChange={(e) => setForm({ ...form, grantUntil: e.target.value })}
          />
        </label>
      </div>
      <p className="mt-2 text-[12px] text-clay">{d.welcomeUntilBlank}</p>
      <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-clay">
        {d.welcomeFollow}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={busy || !live} onClick={save}>
          {busy ? t.common.loading : d.welcomeSave}
        </Button>
        {error && <span className="text-[13px] text-red-700">{error}</span>}
      </div>
    </div>
  );
}
