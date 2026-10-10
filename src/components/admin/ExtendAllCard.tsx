"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Add days to every active pack at once.
 *
 * Two presses, on purpose. The first asks the server what it would touch and
 * says it in a sentence — how many packs, how many members — because "every
 * member" is easy to type and hard to picture. The second does it. A fresh id
 * is made for each confirmation and sent with it, so a double click, a slow
 * network retry or a second press of the same button can never add the days
 * twice: the server refuses an id it has already applied.
 */
export function ExtendAllCard({ onNotice }: { onNotice: (s: string) => void }) {
  const { t } = useI18n();
  const d = t.desk;

  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    packs: number;
    members: number;
    days: number;
    ref: string;
  } | null>(null);

  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 90;

  /* A fresh id per confirmation. `crypto.randomUUID` exists only on HTTPS and
     localhost, so a desk opened over plain http on the studio's wifi would
     otherwise fail at the first press; the fallback is unique enough for an id
     that only has to differ from the last few the studio has used. */
  function newRef() {
    try {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
      }
    } catch {
      /* fall through */
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function fill(s: string, v: Record<string, number>) {
    return Object.entries(v).reduce(
      (out, [k, x]) => out.replace(`{${k}}`, String(x)),
      s,
    );
  }

  async function check() {
    if (!valid) {
      setError(d.extendAllBad);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/extend-all");
      const data = (await res.json()) as { packs?: number; members?: number };
      if (!res.ok) {
        setError(d.packForbidden);
        return;
      }
      if (!data.packs) {
        setError(d.extendAllNone);
        return;
      }
      setPreview({
        packs: data.packs,
        members: data.members ?? 0,
        days: n,
        ref: newRef(),
      });
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/extend-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: preview.days,
          ref: preview.ref,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        packs?: number;
        days?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.error === "ALREADY_DONE"
            ? d.extendAllRepeat
            : data.error === "NOTHING_TO_EXTEND"
              ? d.extendAllNone
              : data.error === "BAD_DAYS"
                ? d.extendAllBad
                : d.packForbidden,
        );
        setPreview(null);
        return;
      }
      onNotice(
        fill(d.extendAllDone, { packs: data.packs ?? 0, days: data.days ?? 0 }),
      );
      setPreview(null);
      setDays("");
      setNote("");
    } catch {
      /* The connection dropped, so whether it was applied is unknown. The
         confirmation is kept with the same id: pressing again is safe, because
         the server refuses an id it has already applied and says so. */
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-mocha-200/70 bg-white/60 p-6 lg:col-span-2">
      <p className="text-[10px] uppercase tracking-brand text-clay">
        {d.extendAllTitle}
      </p>
      <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-clay">
        {d.extendAllHelp}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-[10rem_1fr]">
        <label className="block">
          <span className="label">{d.extendAllDays}</span>
          <input
            className="input"
            inputMode="numeric"
            value={days}
            disabled={busy || preview !== null}
            onChange={(e) => {
              setDays(e.target.value.replace(/[^\d]/g, "").slice(0, 2));
              setError(null);
            }}
          />
        </label>
        <label className="block">
          <span className="label">{d.extendAllNote}</span>
          <input
            className="input"
            maxLength={120}
            value={note}
            disabled={busy || preview !== null}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      {preview ? (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-[#FBF6E7] px-5 py-4">
          <p className="text-[13px] leading-relaxed text-mocha-700">
            {fill(d.extendAllPreview, {
              days: preview.days,
              packs: preview.packs,
              members: preview.members,
            })}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button size="sm" disabled={busy} onClick={() => void confirm()}>
              {busy ? t.common.loading : d.extendAllDo}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              {d.extendAllCancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="mt-6"
          size="sm"
          variant="outline"
          disabled={busy || !days}
          onClick={() => void check()}
        >
          {busy ? t.common.loading : d.extendAllCheck}
        </Button>
      )}

      {error && <p className="mt-3 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
