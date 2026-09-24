"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/**
 * The pricing tab: the packs the studio sells, the codes members can type, and
 * the shopfront offer.
 *
 * Three things keep it safe to hand to the owner. Prices are worked out on the
 * server, so what a member is shown is what they are charged. A pack that has
 * been sold cannot be deleted, only taken off sale, so no invoice is ever
 * orphaned. And every write answers with the fresh list, so the panel redraws
 * from the truth rather than from what it hoped it sent.
 */

type Pack = {
  id: string;
  slug: string;
  nameEn: string;
  nameEl: string;
  credits: number;
  priceCents: number;
  listPriceCents: number | null;
  discountLabelEn: string | null;
  discountLabelEl: string | null;
};

type DeskPack = {
  id: string;
  slug: string;
  nameEn: string;
  nameEl: string;
  credits: number;
  priceCents: number;
  validityDays: number;
  group: string;
  active: boolean;
};

type Promo = {
  id: string;
  code: string;
  kind: "PERCENT" | "FLAT";
  value: number;
  packageId: string | null;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  uses: number;
  state: "LIVE" | "OFF" | "SCHEDULED" | "EXPIRED" | "USED_UP";
};

type Rule = {
  id: string;
  packageId: string | null;
  kind: "PERCENT" | "FLAT";
  value: number;
  labelEn: string;
};

type PackForm = {
  nameEn: string;
  nameEl: string;
  group: string;
  credits: string;
  validityDays: string;
  price: string;
};

const EMPTY_FORM: PackForm = {
  nameEn: "",
  nameEl: "",
  group: "month",
  credits: "10",
  validityDays: "90",
  price: "150",
};

const GROUP_KEYS = [
  "single",
  "month",
  "quarter",
  "half",
  "nine",
  "personal",
] as const;

export function PricingPanel({
  packs,
  onNotice,
}: {
  packs: Pack[];
  onNotice: (s: string) => void;
}) {
  const { t, locale, fmtMoney, fmtSessions } = useI18n();
  const d = t.desk;
  const router = useRouter();
  const name = (p: { nameEn: string; nameEl: string }) =>
    locale === "el" ? p.nameEl : p.nameEn;
  const groupLabel = (g: string) =>
    (d.packGroups as Record<string, string>)[g] ?? g;

  /* -------------------------------------------------------------- packs */
  const [deskPacks, setDeskPacks] = useState<DeskPack[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // pack id, or "new"
  const [form, setForm] = useState<PackForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [topId, setTopId] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadPacks = useCallback(async () => {
    const res = await fetch("/api/admin/packs");
    if (!res.ok) return;
    const data = (await res.json()) as { packs: DeskPack[] };
    setDeskPacks(data.packs ?? []);
  }, []);

  /* -------------------------------------------------------------- promo */
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promo, setPromo] = useState({
    code: "",
    kind: "PERCENT" as "PERCENT" | "FLAT",
    value: "10",
    packageId: "",
    validFrom: "",
    validUntil: "",
    maxUses: "",
  });
  const [promoError, setPromoError] = useState<string | null>(null);

  const loadPromos = useCallback(async () => {
    const res = await fetch("/api/admin/promo");
    if (!res.ok) return;
    const data = (await res.json()) as { promos: Promo[] };
    setPromos(data.promos ?? []);
  }, []);

  /* -------------------------------------------------------------- offers */
  const [rules, setRules] = useState<Rule[]>([]);
  const [scope, setScope] = useState<string>("");
  const [kind, setKind] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [value, setValue] = useState("20");
  const [label, setLabel] = useState("");

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/admin/pricing");
    if (!res.ok) return;
    const data = (await res.json()) as { rules: Rule[] };
    setRules(data.rules ?? []);
  }, []);

  useEffect(() => {
    void loadPacks();
    void loadPromos();
    void loadRules();
  }, [loadPacks, loadPromos, loadRules]);

  /* Common handler for a 401/403/423 answer — the desk lock lapsed. */
  function forbidden(status: number) {
    return status === 401 || status === 403 || status === 423;
  }

  /* ---------------------------------------------------------- pack save */
  function validateForm(): string | null {
    if (form.nameEn.trim().length < 2 && form.nameEl.trim().length < 2) {
      return d.packNeedName;
    }
    const credits = Number(form.credits);
    if (!Number.isInteger(credits) || credits < 1 || credits > 500) {
      return d.packNeedSessions;
    }
    const days = Number(form.validityDays);
    if (!Number.isInteger(days) || days < 1 || days > 1095) {
      return d.packNeedDays;
    }
    const cents = Math.round(Number(form.price.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      return d.packNeedPrice;
    }
    return null;
  }

  async function savePack() {
    const bad = validateForm();
    if (bad) {
      setFormError(bad);
      return;
    }
    setFormError(null);
    setBusy("save");
    try {
      /* Either language is enough; the other copies it, so a pack never has a
         blank name in one language on the price list. */
      const nameEn = form.nameEn.trim() || form.nameEl.trim();
      const nameEl = form.nameEl.trim() || form.nameEn.trim();
      const payload = {
        nameEn,
        nameEl,
        group: form.group,
        credits: Number(form.credits),
        validityDays: Number(form.validityDays),
        priceCents: Math.round(Number(form.price.replace(",", ".")) * 100),
      };
      const creating = editing === "new";
      const res = await fetch("/api/admin/packs", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creating ? payload : { id: editing, ...payload }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        packs?: DeskPack[];
        error?: string;
      };
      if (!res.ok) {
        setFormError(forbidden(res.status) ? d.packForbidden : d.packBad);
        return;
      }
      setDeskPacks(data.packs ?? []);
      if (creating && data.id) setTopId(data.id);
      onNotice(creating ? d.packCreated : d.packSaved);
      setEditing(null);
      setForm(EMPTY_FORM);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function togglePack(p: DeskPack) {
    setBusy(p.id);
    try {
      const res = await fetch("/api/admin/packs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, active: !p.active }),
      });
      const data = (await res.json()) as { packs?: DeskPack[] };
      if (!res.ok) {
        onNotice(forbidden(res.status) ? d.packForbidden : d.packBad);
        return;
      }
      setDeskPacks(data.packs ?? []);
      onNotice(d.packSaved);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removePack(p: DeskPack) {
    /* Two presses, no browser dialog. The first arms; a blur disarms. */
    if (armedDelete !== p.id) {
      setArmedDelete(p.id);
      return;
    }
    setBusy(p.id);
    try {
      const res = await fetch("/api/admin/packs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      });
      const data = (await res.json()) as { packs?: DeskPack[]; error?: string };
      if (!res.ok) {
        if (res.status === 409) onNotice(d.packSold);
        else onNotice(forbidden(res.status) ? d.packForbidden : d.packBad);
        return;
      }
      setDeskPacks(data.packs ?? []);
      onNotice(d.packDeleted);
      router.refresh();
    } finally {
      setArmedDelete(null);
      setBusy(null);
    }
  }

  function openEdit(p: DeskPack) {
    setEditing(p.id);
    setFormError(null);
    setForm({
      nameEn: p.nameEn,
      nameEl: p.nameEl,
      group: p.group,
      credits: String(p.credits),
      validityDays: String(p.validityDays),
      price: (p.priceCents / 100).toString(),
    });
  }

  /* --------------------------------------------------------- promo save */
  async function createPromo() {
    setPromoError(null);
    if (promo.code.trim().length < 2) {
      setPromoError(d.promoBad);
      return;
    }
    setBusy("promo");
    try {
      const res = await fetch("/api/admin/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promo.code,
          kind: promo.kind,
          /* Percent goes as typed; euros go as cents, the same as the offers
             form above — so "Euro off 10" is €10, not 10 cents. */
          value:
            promo.kind === "PERCENT"
              ? Math.round(Number(promo.value.replace(",", ".")))
              : Math.round(Number(promo.value.replace(",", ".")) * 100),
          packageId: promo.packageId || null,
          validFrom: promo.validFrom || null,
          validUntil: promo.validUntil || null,
          maxUses: promo.maxUses ? Number(promo.maxUses) : null,
        }),
      });
      const data = (await res.json()) as { promos?: Promo[]; error?: string };
      if (!res.ok) {
        if (forbidden(res.status)) setPromoError(d.packForbidden);
        else if (data.error === "TAKEN") setPromoError(d.promoTaken);
        else setPromoError(d.promoBad);
        return;
      }
      setPromos(data.promos ?? []);
      onNotice(d.promoCreated);
      setPromo({
        code: "",
        kind: "PERCENT",
        value: "10",
        packageId: "",
        validFrom: "",
        validUntil: "",
        maxUses: "",
      });
    } finally {
      setBusy(null);
    }
  }

  async function togglePromo(pr: Promo) {
    setBusy(pr.id);
    try {
      const res = await fetch("/api/admin/promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pr.id, active: !pr.active }),
      });
      const data = (await res.json()) as { promos?: Promo[] };
      if (res.ok) setPromos(data.promos ?? []);
    } finally {
      setBusy(null);
    }
  }

  async function deletePromo(pr: Promo) {
    setBusy(pr.id);
    try {
      const res = await fetch("/api/admin/promo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pr.id }),
      });
      const data = (await res.json()) as { promos?: Promo[] };
      if (res.ok) setPromos(data.promos ?? []);
    } finally {
      setBusy(null);
    }
  }

  /* --------------------------------------------------------- offer save */
  async function applyRule() {
    setBusy("apply");
    try {
      const raw = Number(value.replace(",", "."));
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: scope || null,
          kind,
          value: kind === "PERCENT" ? Math.round(raw) : Math.round(raw * 100),
          labelEn: label || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (data.error) {
        onNotice(data.error);
        return;
      }
      onNotice(d.priceApplied);
      await loadRules();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function clearRules(all: boolean, packageId?: string | null) {
    setBusy(all ? "clear" : (packageId ?? "list"));
    try {
      const q = all ? "all=1" : packageId ? `packageId=${packageId}` : "";
      await fetch(`/api/admin/pricing?${q}`, { method: "DELETE" });
      onNotice(d.priceCleared);
      await loadRules();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const listRule = rules.find((r) => r.packageId === null);

  /* Newest-created pack floated to the top so it sits by the form. */
  const orderedPacks = topId
    ? [
        ...deskPacks.filter((p) => p.id === topId),
        ...deskPacks.filter((p) => p.id !== topId),
      ]
    : deskPacks;

  const panel = "rounded-3xl border border-mocha-200/70 bg-white/60 p-6";
  const heading = "text-[10px] uppercase tracking-brand text-clay";

  return (
    <div className="mt-10 space-y-6">
      {/* ================================================= PACKS */}
      <div className={panel} data-desk-panel="packs">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className={heading}>{d.packsSectionTitle}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing("new");
              setForm(EMPTY_FORM);
              setFormError(null);
            }}
          >
            {d.packNew}
          </Button>
        </div>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-clay">
          {d.packsManageHelp}
        </p>

        {editing && (
          <div className="mt-5 rounded-2xl border border-mocha-200 bg-cream-50/40 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="label">{d.packNameEn}</span>
                <input
                  className="input"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="label">{d.packNameEl}</span>
                <input
                  className="input"
                  value={form.nameEl}
                  onChange={(e) => setForm({ ...form, nameEl: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="label">{d.packHeading}</span>
                <select
                  className="input"
                  value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })}
                >
                  {GROUP_KEYS.map((g) => (
                    <option key={g} value={g}>
                      {groupLabel(g)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">{d.packSessions}</span>
                <input
                  className="input lining-nums tabular-nums"
                  inputMode="numeric"
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="label">{d.packDaysField}</span>
                <input
                  className="input lining-nums tabular-nums"
                  inputMode="numeric"
                  value={form.validityDays}
                  onChange={(e) =>
                    setForm({ ...form, validityDays: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="label">{d.packPriceField}</span>
                <input
                  className="input lining-nums tabular-nums"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="sm" disabled={busy === "save"} onClick={savePack}>
                {busy === "save" ? t.common.loading : d.packSave}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setFormError(null);
                }}
              >
                {d.packCancel}
              </Button>
              {formError && (
                <span className="text-[13px] text-red-700">{formError}</span>
              )}
            </div>
          </div>
        )}

        <ul className="mt-5 divide-y divide-mocha-200/70">
          {orderedPacks.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <span className="text-[14px] text-mocha-600">
                {name(p)}
                <span className="ml-3 text-[12px] text-clay">
                  {fmtSessions(p.credits)} · {p.validityDays}d
                </span>
                <span className="ml-3 rounded-full bg-mocha-100 px-2 py-0.5 text-[10px] uppercase tracking-widest text-mocha-500">
                  {groupLabel(p.group)}
                </span>
                {!p.active && (
                  <span className="ml-2 rounded-full bg-clay/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-clay">
                    {d.packOff}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="lining-nums tabular-nums text-mocha-600">
                  {fmtMoney(p.priceCents)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === p.id}
                  onClick={() => openEdit(p)}
                >
                  {d.packEdit}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === p.id}
                  onClick={() => void togglePack(p)}
                >
                  {p.active ? d.packSwitchOff : d.packSwitchOn}
                </Button>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void removePack(p)}
                  onBlur={() => setArmedDelete((a) => (a === p.id ? null : a))}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] uppercase tracking-widest transition-colors",
                    armedDelete === p.id
                      ? "bg-red-600 text-white"
                      : "text-clay hover:text-red-700",
                  )}
                >
                  {armedDelete === p.id ? d.packDeleteConfirm : d.packDelete}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ================================================= PROMO CODES */}
      <div className={panel} data-desk-panel="promo">
        <p className={heading}>{d.promoSectionTitle}</p>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-clay">
          {d.promoHelp}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="label">{d.promoCode}</span>
            <input
              className="input uppercase"
              value={promo.code}
              onChange={(e) => setPromo({ ...promo, code: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">{d.promoKind}</span>
            <select
              className="input"
              value={promo.kind}
              onChange={(e) =>
                setPromo({ ...promo, kind: e.target.value as "PERCENT" | "FLAT" })
              }
            >
              <option value="PERCENT">{d.promoPercent}</option>
              <option value="FLAT">{d.promoEuro}</option>
            </select>
          </label>
          <label className="block">
            <span className="label">{d.promoAmount}</span>
            <input
              className="input lining-nums tabular-nums"
              inputMode="decimal"
              value={promo.value}
              onChange={(e) => setPromo({ ...promo, value: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">{d.promoApplies}</span>
            <select
              className="input"
              value={promo.packageId}
              onChange={(e) =>
                setPromo({ ...promo, packageId: e.target.value })
              }
            >
              <option value="">{d.promoWholeList}</option>
              {deskPacks.map((p) => (
                <option key={p.id} value={p.id}>
                  {name(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{d.promoFrom}</span>
            <input
              type="date"
              className="input"
              value={promo.validFrom}
              onChange={(e) => setPromo({ ...promo, validFrom: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">{d.promoUntil}</span>
            <input
              type="date"
              className="input"
              value={promo.validUntil}
              onChange={(e) =>
                setPromo({ ...promo, validUntil: e.target.value })
              }
            />
          </label>
          <label className="block">
            <span className="label">{d.promoMax}</span>
            <input
              className="input lining-nums tabular-nums"
              inputMode="numeric"
              placeholder={d.promoNoLimit}
              value={promo.maxUses}
              onChange={(e) => setPromo({ ...promo, maxUses: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={busy === "promo"} onClick={createPromo}>
            {busy === "promo" ? t.common.loading : d.promoCreate}
          </Button>
          {promoError && (
            <span className="text-[13px] text-red-700">{promoError}</span>
          )}
        </div>

        {promos.length === 0 ? (
          <p className="mt-5 text-sm text-clay">{d.promoNone}</p>
        ) : (
          <ul className="mt-5 divide-y divide-mocha-200/70">
            {promos.map((pr) => (
              <li
                key={pr.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="text-[14px] text-mocha-600">
                  <span className="font-mono uppercase">{pr.code}</span>
                  <span className="ml-3 text-[12px] text-clay">
                    {pr.kind === "PERCENT"
                      ? `${pr.value}%`
                      : fmtMoney(pr.value)}
                    {" · "}
                    {pr.packageId
                      ? name(
                          deskPacks.find((p) => p.id === pr.packageId) ?? {
                            nameEn: "?",
                            nameEl: "?",
                          },
                        )
                      : d.promoWholeList}
                  </span>
                  <span className="ml-3 rounded-full bg-mocha-100 px-2 py-0.5 text-[10px] uppercase tracking-widest text-mocha-500">
                    {(d.promoStates as Record<string, string>)[pr.state]}
                  </span>
                </span>
                <span className="flex items-center gap-3 text-[12px] text-clay">
                  <span className="lining-nums tabular-nums">
                    {pr.uses}
                    {pr.maxUses != null ? `/${pr.maxUses}` : ""} {d.promoUses}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === pr.id}
                    onClick={() => void togglePromo(pr)}
                  >
                    {pr.active ? d.packSwitchOff : d.packSwitchOn}
                  </Button>
                  <button
                    type="button"
                    disabled={busy === pr.id}
                    onClick={() => void deletePromo(pr)}
                    className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-widest text-clay transition-colors hover:text-red-700"
                  >
                    {d.promoDelete}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ================================================= OFFERS */}
      <div className={panel} data-desk-panel="offers">
        <p className={heading}>{d.offersSectionTitle}</p>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-clay">
          {d.priceHelp}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="label">{d.priceScope}</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="input"
            >
              <option value="">{d.priceAll}</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {name(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{d.priceKind}</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "PERCENT" | "FLAT")}
              className="input"
            >
              <option value="PERCENT">{d.pricePercent}</option>
              <option value="FLAT">{d.priceFlat}</option>
            </select>
          </label>
          <label className="block">
            <span className="label">{d.priceValue}</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              className="input lining-nums tabular-nums"
            />
          </label>
          <label className="block">
            <span className="label">{d.priceLabel}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="sm" disabled={busy === "apply"} onClick={applyRule}>
            {busy === "apply" ? t.common.loading : d.priceApply}
          </Button>
          {rules.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "clear"}
              onClick={() => void clearRules(true)}
            >
              {d.priceClear}
            </Button>
          )}
        </div>

        <div className="mt-6 border-t border-mocha-200/70 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className={heading}>{d.priceLive}</p>
            {listRule && (
              <p className="text-[11px] text-clay">
                {d.priceAll}:{" "}
                {listRule.kind === "PERCENT"
                  ? `${listRule.value}%`
                  : fmtMoney(listRule.value)}
              </p>
            )}
          </div>

          {rules.length === 0 && (
            <p className="mt-5 text-sm text-clay">{d.priceNone}</p>
          )}

          <ul className="mt-5 divide-y divide-mocha-200/70">
            {packs.map((p) => {
              const own = rules.find((r) => r.packageId === p.id);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="text-[14px] text-mocha-600">
                    {name(p)}
                    <span className="ml-3 text-[12px] text-clay">
                      {fmtSessions(p.credits)}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="lining-nums tabular-nums">
                      {p.listPriceCents ? (
                        <>
                          <span className="text-clay line-through">
                            {fmtMoney(p.listPriceCents)}
                          </span>
                          <span className="ml-2 text-mocha-600">
                            {fmtMoney(p.priceCents)}
                          </span>
                        </>
                      ) : (
                        <span className="text-mocha-600">
                          {fmtMoney(p.priceCents)}
                        </span>
                      )}
                    </span>
                    {own && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === p.id}
                        onClick={() => void clearRules(false, p.id)}
                      >
                        {t.common.cancel}
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
