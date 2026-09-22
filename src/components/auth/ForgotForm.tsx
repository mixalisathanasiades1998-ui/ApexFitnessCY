"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Step one of a reset: ask for the address, then say a link is on its way.
 *
 * The confirmation is deliberately the same whether or not the address belongs
 * to an account — the server never says which, and neither does this. Somebody
 * who mistyped their address sees "check your inbox" too; the alternative tells
 * a stranger which addresses are members.
 */
export function ForgotForm() {
  const { t } = useI18n();
  const a = t.auth;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setSent(true);
        return;
      }
      if (res.status === 429) {
        setError(a.forgotTooMany);
        return;
      }
      setError(
        data.error === "EMAIL_INVALID" ? a.errEmail : t.common.somethingWrong,
      );
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
          <h1 className="h-display mt-8 text-4xl">{a.forgotTitle}</h1>
          <p className="mt-3 text-sm text-mocha-500">
            {sent ? a.forgotSentBody : a.forgotBody}
          </p>
        </div>

        {sent ? (
          <div className="mt-10 rounded-4xl border border-mocha-200/70 bg-white/70 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-mocha-600">{a.forgotSentNote}</p>
            <Link
              href="/login"
              className="link-underline mt-6 inline-block text-mocha-600"
            >
              {a.backToSignIn}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submit}
            noValidate
            className="mt-10 rounded-4xl border border-mocha-200/70 bg-white/70 p-8 backdrop-blur-sm"
          >
            <div>
              <label className="label" htmlFor="email">
                {t.common.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>

            {error && (
              <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" className="mt-8 w-full" disabled={busy || !email}>
              {busy ? t.common.loading : a.forgotSend}
            </Button>

            <p className="mt-6 text-center text-[12px] text-mocha-500">
              <Link href="/login" className="link-underline text-mocha-600">
                {a.backToSignIn}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
