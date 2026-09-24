"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { useI18n } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/**
 * The studio's team, from the desk.
 *
 * The database is the team; the code roster only starts it off. Editing anyone
 * here takes the row out of the roster's hands, and nobody is ever deleted —
 * hiding takes them off the page while their name stays on the classes they
 * taught. Every write answers with the fresh list.
 */

type Member = {
  id: string;
  name: string;
  bioEn: string;
  bioEl: string;
  photoUrl: string | null;
  active: boolean;
  sortOrder: number;
};

type Form = {
  name: string;
  photoUrl: string;
  bioEn: string;
  bioEl: string;
};

const EMPTY: Form = { name: "", photoUrl: "", bioEn: "", bioEl: "" };

export function TeamPanel({ onNotice }: { onNotice: (s: string) => void }) {
  const { t } = useI18n();
  const d = t.desk;
  const router = useRouter();

  const [team, setTeam] = useState<Member[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/team");
    if (!res.ok) return;
    const data = (await res.json()) as { team: Member[] };
    setTeam(data.team ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function forbidden(status: number) {
    return status === 401 || status === 403 || status === 423;
  }

  async function save() {
    if (form.name.trim().length < 2) {
      setError(d.teamBad);
      return;
    }
    setError(null);
    setBusy("save");
    try {
      const creating = editing === "new";
      const res = await fetch("/api/admin/team", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          creating ? { ...form } : { id: editing, ...form },
        ),
      });
      const data = (await res.json()) as { team?: Member[]; error?: string };
      if (!res.ok) {
        if (forbidden(res.status)) setError(d.packForbidden);
        else if (data.error === "NAME_TAKEN") setError(d.teamNameTaken);
        else setError(d.teamBad);
        return;
      }
      setTeam(data.team ?? []);
      onNotice(creating ? d.teamAdded : d.teamSaved);
      setEditing(null);
      setForm(EMPTY);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function toggle(m: Member) {
    setBusy(m.id);
    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, active: !m.active }),
      });
      const data = (await res.json()) as { team?: Member[] };
      if (res.ok) {
        setTeam(data.team ?? []);
        onNotice(d.teamSaved);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: Member) {
    /* Two presses, no browser dialog — the first arms, a blur disarms. */
    if (armedDelete !== m.id) {
      setArmedDelete(m.id);
      return;
    }
    setBusy(m.id);
    try {
      const res = await fetch("/api/admin/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id }),
      });
      const data = (await res.json()) as { team?: Member[]; error?: string };
      if (!res.ok) {
        onNotice(forbidden(res.status) ? d.packForbidden : d.teamBad);
        return;
      }
      setTeam(data.team ?? []);
      onNotice(d.teamDeleted);
      router.refresh();
    } finally {
      setArmedDelete(null);
      setBusy(null);
    }
  }

  /* Upload a portrait for the instructor being edited. Needs a saved instructor
     to attach to, so it is only offered once the row exists. */
  async function uploadPhoto(file: File) {
    if (!editing || editing === "new") return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("instructorId", editing);
      fd.append("photo", file);
      const res = await fetch("/api/admin/team/photo", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { photoUrl?: string; error?: string };
      if (!res.ok || !data.photoUrl) {
        setError(forbidden(res.status) ? d.packForbidden : d.teamPhotoBad);
        return;
      }
      setForm((f) => ({ ...f, photoUrl: data.photoUrl! }));
      await load();
      onNotice(d.teamSaved);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function openEdit(m: Member) {
    setEditing(m.id);
    setError(null);
    setForm({
      name: m.name,
      photoUrl: m.photoUrl ?? "",
      bioEn: m.bioEn,
      bioEl: m.bioEl,
    });
  }

  return (
    <div className="mt-10 space-y-6">
      <div
        className="rounded-3xl border border-mocha-200/70 bg-white/60 p-6"
        data-desk-panel="team"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[10px] uppercase tracking-brand text-clay">
            {d.teamTitle}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing("new");
              setForm(EMPTY);
              setError(null);
            }}
          >
            {d.teamAdd}
          </Button>
        </div>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-clay">
          {d.teamHelp}
        </p>

        {editing && (
          <div className="mt-5 rounded-2xl border border-mocha-200 bg-cream-50/40 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">{d.teamName}</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="label">{d.teamPhoto}</span>
                <input
                  className="input"
                  value={form.photoUrl}
                  onChange={(e) =>
                    setForm({ ...form, photoUrl: e.target.value })
                  }
                />
                <span className="mt-1 block text-[11px] text-clay">
                  {d.teamPhotoHelp}
                </span>
                {/* Upload a photo instead of typing a path. Only once the
                    instructor exists, since the file attaches to their row. */}
                {editing !== "new" ? (
                  <span className="mt-3 block">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadPhoto(f);
                        e.target.value = "";
                      }}
                      className="block w-full text-[12px] text-mocha-500 file:mr-3 file:rounded-full file:border file:border-mocha-300 file:bg-white file:px-4 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:text-mocha-600 hover:file:border-mocha-500"
                    />
                    <span className="mt-1 block text-[11px] text-clay">
                      {uploading ? t.common.loading : d.teamUploadHelp}
                    </span>
                  </span>
                ) : (
                  <span className="mt-2 block text-[11px] text-clay">
                    {d.teamUploadFirst}
                  </span>
                )}
              </label>
              <label className="block">
                <span className="label">{d.teamBioEn}</span>
                <textarea
                  className="input min-h-[96px]"
                  maxLength={600}
                  value={form.bioEn}
                  onChange={(e) => setForm({ ...form, bioEn: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="label">{d.teamBioEl}</span>
                <textarea
                  className="input min-h-[96px]"
                  maxLength={600}
                  value={form.bioEl}
                  onChange={(e) => setForm({ ...form, bioEl: e.target.value })}
                />
                <span className="mt-1 block text-[11px] text-clay">
                  {d.teamBioFallback}
                </span>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="sm" disabled={busy === "save"} onClick={save}>
                {busy === "save" ? t.common.loading : d.packSave}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setError(null);
                }}
              >
                {d.packCancel}
              </Button>
              {error && (
                <span className="text-[13px] text-red-700">{error}</span>
              )}
            </div>
          </div>
        )}

        <ul className="mt-5 divide-y divide-mocha-200/70">
          {team.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <span className="flex items-center gap-3">
                {m.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photoUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-200">
                    <Monogram className="h-5 w-5 text-clay/50" />
                  </span>
                )}
                <span className="text-[14px] text-mocha-600">
                  {m.name}
                  {!m.active && (
                    <span className="ml-2 rounded-full bg-clay/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-clay">
                      {d.teamHide}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === m.id}
                  onClick={() => openEdit(m)}
                >
                  {d.teamEdit}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === m.id}
                  onClick={() => void toggle(m)}
                >
                  {m.active ? d.teamHide : d.teamRestore}
                </Button>
                <button
                  type="button"
                  disabled={busy === m.id}
                  onClick={() => void remove(m)}
                  onBlur={() =>
                    setArmedDelete((a) => (a === m.id ? null : a))
                  }
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] uppercase tracking-widest transition-colors",
                    armedDelete === m.id
                      ? "bg-red-600 text-white"
                      : "text-clay hover:text-red-700",
                  )}
                >
                  {armedDelete === m.id ? d.teamDeleteConfirm : d.teamDelete}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
