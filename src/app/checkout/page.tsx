import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutBody } from "@/components/checkout/CheckoutBody";
import { currentUser, isVerified } from "@/lib/auth";
import { getPackageBySlug } from "@/lib/catalogue";
import { getCreditSummary, startChoices } from "@/lib/credits";
import type { CreditKind } from "@/lib/packs";
import { paymentModeSummary } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Checkout",
  /* A payment page has no business in anybody's search results. */
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const { pack } = await searchParams;
  if (!pack) redirect("/pricing");

  const user = await currentUser();
  /* Straight back here once they are in, with the pack still chosen. */
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/checkout?pack=${pack}`)}`);
  }
  /* Nobody pays for sessions on an account that has never confirmed its email:
     the receipt, and every reminder afterwards, goes to an address we have no
     reason to believe exists. Carries the pack through, so the code box leads
     back to this exact checkout rather than to the pricing page. */
  if (!isVerified(user)) {
    redirect(
      `/verify?next=${encodeURIComponent(`/checkout?pack=${pack}`)}`,
    );
  }

  const pkg = await getPackageBySlug(pack);
  if (!pkg || !pkg.active) redirect("/pricing");

  const wallet = await getCreditSummary(user.id);
  const payment = paymentModeSummary();
  /* When the pack should start: the suggested day, the range the member may
     choose from, and what they hold now so the page can explain the
     suggestion. Worked out here, from the same rule the server enforces. */
  const kind: CreditKind =
    pkg.kind === "PERSONAL" || pkg.kind === "DUET" ? pkg.kind : "CLASS";
  const start = startChoices(user.id, kind);

  return (
    <CheckoutBody
      pack={{
        id: pkg.id,
        slug: pkg.slug,
        nameEn: pkg.nameEn,
        nameEl: pkg.nameEl,
        credits: pkg.credits,
        priceCents: pkg.priceCents,
        validityDays: pkg.validityDays,
      }}
      member={{ name: user.name, email: user.email }}
      balance={wallet.available}
      payment={payment}
      start={start}
    />
  );
}
