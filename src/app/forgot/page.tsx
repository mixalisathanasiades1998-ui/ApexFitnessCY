import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Reset your password" };
export const dynamic = "force-dynamic";

export default async function ForgotPage() {
  /* Somebody already signed in does not need this. Database-backed like the
     login page, so a stale cookie for a gone account lands on the form rather
     than bouncing. */
  if (await currentUser()) redirect("/account");
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
