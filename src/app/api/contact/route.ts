import { NextResponse } from "next/server";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { clientIp, hit, tooMany } from "@/lib/rate-limit";
import { contactSchema } from "@/lib/validation";

/**
 * Stores enquiries in the database so nothing is lost before email is wired up.
 * To also send email, add your provider (Resend / SendGrid / SMTP) here.
 */
export async function POST(req: Request) {
  /* Unauthenticated and it writes a row, so it is throttled per address: ten
     messages an hour is more than anyone with something to say will send. */
  const rl = hit("contact", clientIp(req), 10, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const parsed = contactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message" },
      { status: 400 },
    );
  }

  db.insert(contactMessages)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      message: parsed.data.message,
    })
    .run();

  return NextResponse.json({ ok: true });
}
