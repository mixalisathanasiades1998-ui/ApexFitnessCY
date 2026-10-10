import type { Metadata } from "next";
import { CheckoutResult } from "@/components/marketing/CheckoutResult";
import { currentUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditBatches, purchases } from "@/db/schema";
import { getAvailableCredits } from "@/lib/credits";
import { studioDateKey } from "@/lib/time";
import { settleForMember } from "@/lib/payments/settle-once";

export const metadata: Metadata = {
  title: "Payment complete",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  /* `p` is our purchase id. Stripe adds its own parameters when it brings the
     member back from a 3-D Secure screen; we ignore them and ask the provider
     ourselves rather than believing anything in the URL. */
  searchParams: Promise<{ p?: string }>;
}) {
  const [{ p }, user] = await Promise.all([searchParams, currentUser()]);

  /* Settling here as well as in the browser is what makes a lost connection
     survivable: a member whose card cleared and whose laptop then died still
     gets their sessions the moment they open this page again. */
  if (user && p) await settleForMember(user.id, p);

  const credits = user ? await getAvailableCredits(user.id) : 0;

  /* If this pack was bought to start on a later day, say so. Read from the
     sessions actually granted, not from the request, so the page shows what
     the member holds. */
  let window: { startsOn: string; endsOn: string | null } | null = null;
  if (user && p) {
    const mine = db
      .select({ id: purchases.id })
      .from(purchases)
      .where(and(eq(purchases.id, p), eq(purchases.userId, user.id)))
      .get();
    const batch = mine
      ? db
          .select()
          .from(creditBatches)
          .where(eq(creditBatches.purchaseId, mine.id))
          .get()
      : undefined;
    if (batch?.usableFrom && batch.usableFrom > new Date()) {
      window = {
        startsOn: studioDateKey(batch.usableFrom),
        endsOn: batch.expiresAt ? studioDateKey(batch.expiresAt) : null,
      };
    }
  }

  return <CheckoutResult kind="success" credits={credits} packWindow={window} />;
}
