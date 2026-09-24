"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * A password box with an eye to reveal what was typed.
 *
 * A hidden password is the safe default — somebody may be at the studio counter
 * with people behind them — but typing a new one you cannot see, and confirming
 * it, only to be told the two do not match is a small misery the eye removes.
 * Off by default, theirs to turn on, and each field has its own toggle.
 *
 * Works both ways. Pass `value`/`onChange` and it is controlled, for a form
 * that has to compare two boxes (the reset page, the password tab). Leave them
 * off and it is a plain named field the surrounding form reads from FormData
 * (sign in, register). The toggle's words come from the dictionary, so no caller
 * has to pass them.
 */
export function PasswordField({
  id,
  name,
  label,
  autoComplete = "new-password",
  minLength,
  hint,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  label: string;
  autoComplete?: "current-password" | "new-password";
  minLength?: number;
  hint?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const controlled = value !== undefined;
  const toggleLabel = visible ? t.auth.hidePassword : t.auth.showPassword;

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name ?? id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className="input pr-12"
          {...(controlled
            ? { value, onChange: (e) => onChange?.(e.target.value) }
            : {})}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-4 text-clay transition-colors hover:text-mocha-600"
        >
          {visible ? (
            /* eye-off */
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            /* eye */
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p className="mt-2 text-[11px] text-clay">{hint}</p>}
    </div>
  );
}
