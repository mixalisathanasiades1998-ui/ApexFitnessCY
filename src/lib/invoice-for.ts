import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creditPackages, purchases, users } from "@/db/schema";
import { invoicePdf, type InvoiceData } from "./invoice-pdf";

/**
 * The invoice for one purchase, gathered from the database and drawn.
 *
 * One function, three callers: the confirmation email attaches what it returns,
 * the member downloads it from their account, and the desk downloads it from a
 * member's card. Having them share this rather than each assemble their own
 * `InvoiceData` is the difference between one invoice and three documents that
 * disagree about what somebody bought.
 *
 * Returns null when there is nothing to draw — no such purchase, or one that has
 * not been paid. Never throws for those: two of the three callers are showing
 * somebody a page, and a missing invoice is a 404, not a stack trace.
 */
export async function invoiceForPurchase(purchaseId: string) {
  const row = db
    .select({
      id: purchases.id,
      userId: purchases.userId,
      credits: purchases.credits,
      amountCents: purchases.amountCents,
      currency: purchases.currency,
      status: purchases.status,
      provider: purchases.provider,
      providerRef: purchases.providerRef,
      paidAt: purchases.paidAt,
      createdAt: purchases.createdAt,
      invoiceNo: purchases.invoiceNo,
      name: users.name,
      email: users.email,
      packEn: creditPackages.nameEn,
    })
    .from(purchases)
    .innerJoin(users, eq(purchases.userId, users.id))
    .leftJoin(creditPackages, eq(purchases.packageId, creditPackages.id))
    .where(eq(purchases.id, purchaseId))
    .get();

  if (!row) return null;
  if (row.status !== "PAID") return null;

  const data: InvoiceData = {
    invoiceNo: row.invoiceNo,
    /* The moment the money arrived, not the moment the checkout page opened.
       An invoice is dated by the payment. */
    issuedAt: row.paidAt ?? row.createdAt,
    /* The pack as it was called when it was sold. A pack renamed or withdrawn
       since must not change what an old invoice says was bought. */
    description: row.packEn
      ? `${row.packEn} - Reformer Pilates`
      : `${row.credits} Reformer Pilates sessions`,
    credits: row.credits,
    grossCents: row.amountCents,
    currency: row.currency,
    customer: { name: row.name, email: row.email },
    paidWith: paidWithWords(row.provider),
    reference: row.providerRef,
  };

  return {
    userId: row.userId,
    invoiceNo: row.invoiceNo,
    filename: filenameFor(row.invoiceNo, row.id),
    pdf: await invoicePdf(data),
  };
}

/** What the studio was paid with, in words rather than a provider slug. */
function paidWithWords(provider: string) {
  switch (provider) {
    case "stripe":
      return "Card";
    case "cash":
      return "Cash";
    case "card_at_desk":
      return "Card at the studio";
    case "test":
      return "Test payment";
    default:
      return provider;
  }
}

/**
 * What the file is called when it lands in somebody's downloads.
 *
 * The invoice number, because that is the thing an accountant searches for. A
 * document with no number falls back to the purchase id, which is at least
 * unique — a folder of files all called `invoice.pdf` is its own small disaster.
 */
function filenameFor(invoiceNo: string | null, purchaseId: string) {
  const stem = invoiceNo ?? `specimen-${purchaseId.slice(0, 8)}`;
  return `APEX-pilates-invoice-${stem}.pdf`;
}
