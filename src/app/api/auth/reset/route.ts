import { NextResponse } from "next/server";
import { z } from "zod";
import { PASSWORD_MIN } from "@/lib/validation";
import { checkResetToken, consumeReset } from "@/lib/password-reset";

/**
 * "I forgot my password" — step two: check the link, then set the password.
 *
 * GET answers whether the link in the URL is still good, so the page can show a
 * dead-link message before somebody types a password into a form that would only
 * refuse it. POST sets the new password and spends the link.
 *
 * Both are unauthenticated on purpose: the token is the credential, and the
 * person using it is by definition someone who cannot sign in.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const check = checkResetToken(token);
  if (check.ok) return NextResponse.json({ valid: true });
  return NextResponse.json({ valid: false, error: check.code });
}

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(PASSWORD_MIN, "PASSWORD_SHORT").max(200, "PASSWORD_LONG"),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    /* The password rule is the only thing to name; a missing token just reads
       as an invalid link. */
    const code = parsed.error.issues[0]?.message ?? "BAD_REQUEST";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const result = await consumeReset(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
