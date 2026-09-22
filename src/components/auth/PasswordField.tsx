"use client";

import { useState } from "react";

/**
 * A password box with an eye to reveal what was typed.
 *
 * A hidden password is the safe default — somebody may be at the studio counter
 * with people behind them — but typing a new one you cannot see, twice, and
 * getting told they do not match is a small misery the eye removes. Off by
 * default, theirs to turn on.
 *
 * Controlled: the reset form has to compare two of these, so the value lives in
 * the parent and this only draws it.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "new-password",
  show,
  hide,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  /** Accessible labels for the toggle, in the reader's language. */
  show: string;
  hide: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="input pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hide : show}
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
    </div>
  );
}
