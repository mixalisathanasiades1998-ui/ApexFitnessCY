import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth/ResetForm";
import { checkResetToken } from "@/lib/password-reset";

export const metadata: Metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

/**
 * The page a reset link opens.
 *
 * The token is validated here, on the server, before anything renders: a dead
 * or spent link shows the "ask again" message rather than a password form. Not
 * signed-in-guarded on purpose — the whole point is that the person cannot sign
 * in, and the token, not a session, is what authorises them.
 */
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const check = checkResetToken(token ?? "");
  return (
    <Suspense>
      <ResetForm
        token={token ?? ""}
        valid={check.ok}
        reason={check.ok ? undefined : check.code}
      />
    </Suspense>
  );
}
