# Invoice fonts

`LiberationSans-Regular.ttf` and `LiberationSans-Bold.ttf` — Liberation Sans 2.1.5,
licensed under the SIL Open Font License 1.1 (https://openfontlicense.org).

Used by `src/lib/invoice-pdf.ts` so invoices print customer names written in
Greek or Cyrillic correctly. Metric-compatible with Helvetica/Arial, so the
invoice layout is unchanged. Read from disk on the server only; not served.
