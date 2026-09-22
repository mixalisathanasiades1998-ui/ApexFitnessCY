"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { PasswordField } from "@/components/auth/PasswordField";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Step two of a reset: choose a new password, twice, behind a link.
 *
 * `valid` is decided on the server before the page renders, so a dead or spent
 * link never shows the form at all — the person is told plainly and pointed back
 * to asking for a fresh one, rather than typing a password into a box that would
 * only refuse it.
 *
 * The two boxes must match, and each has an eye, because a password you cannot
 * see, entered twice, is the one thing most likely to send somebody round this
 * loop a second time.
 */
export function ResetForm({
  token,
  valid,
  reason,
}: {
  token: string;
  valid: boolean;
  reason?: string;
}) {
  const { t } = useI18n();
  const a = t.auth;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const deadReason =
    reason === "EXPIRED"
      ? a.resetExpired
      : reason === "USED"
        ? a.resetUsed
        : a.resetInvalid;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(a.errPassword);
      return;
    }
    if (password !== confirm) {
      setError(a.resetMismatch);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setDone(true);
        return;
      }
      const known: Record<string, string> = {
        PASSWORD_SHORT: a.errPassword,
        EXPIRED: a.resetExpired,
        USED: a.resetUsed,
        INVALID: a.resetInvalid,
      };
      setError(known[data.error ?? ""] ?? t.common.somethingWrong);
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Monogram className="mx-auto h-11 w-11 text-clay/60" />
          <h1 className="h-display mt-8 text-4xl">{a.resetTitle}</h1>
          <p className="mt-3 text-sm text-mocha-500">
            {done ? a.resetDoneBody : valid ? a.resetBody : a.resetDeadBody}
          </p>
        </div>

        {done ? (
          <div className="mt-10 rounded-4xl border border-mocha-200/70 bg-white/70 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-mocha-600">{a.resetDoneNote}</p>
            <Link href="/login" className="mt-6 inline-block">
              <Button>{a.signIn}</Button>
            </Link>
          </div>
        ) : !valid ? (
          <div className="mt-10 rounded-4xl border border-mocha-200/70 bg-white/70 p-8 text-center backdrop-blur-sm">
            <p className="rounded-xl border border-gold/60 bg-gold/[0.07] px-4 py-3 text-sm text-mocha-700">
              {deadReason}
            </p>
            <Link
              href="/forgot"
              className="link-underline mt-6 inline-block text-mocha-600"
            >
              {a.resetAskAgain}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submit}
            noValidate
            className="mt-10 space-y-5 rounded-4xl border border-mocha-200/70 bg-white/70 p-8 backdrop-blur-sm"
          >
            <PasswordField
              id="password"
              label={a.resetNew}
              value={password}
              onChange={setPassword}
              show={a.showPassword}
              hide={a.hidePassword}
            />
            <p className="text-[11px] text-clay">{a.passwordHint}</p>
            <PasswordField
              id="confirm"
              label={a.resetConfirm}
              value={confirm}
              onChange={setConfirm}
              show={a.showPassword}
              hide={a.hidePassword}
            />

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={busy || !password || !confirm}
            >
              {busy ? t.common.loading : a.resetDo}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
