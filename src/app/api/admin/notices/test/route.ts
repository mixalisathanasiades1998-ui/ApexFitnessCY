import { NextResponse } from "next/server";
import { body, owner } from "@/lib/api-guard";
import { emailTransport } from "@/lib/messaging/email";
import type { Outgoing } from "@/lib/messaging/types";
import { forEmailParts } from "@/lib/messaging/wording";

/**
 * A notice, sent once to one address, before it goes to everybody.
 *
 * The desk writes a message for four hundred people and, until now, the first
 * time anybody saw it as an email was in four hundred inboxes. This sends the
 * same letter those members would get — composed by the same code, signed the
 * same way — to one address the owner types in, and does nothing else:
 *
 *   - no notice is created, so nobody's account shows it and no badge lights;
 *   - nothing is recorded in the history or the delivery counts;
 *   - no push and no SMS. A test text message would cost money, and a test
 *     push would go to whichever devices happen to be signed in as the owner.
 *
 * When a Russian version is written, two letters go: the one members reading in
 * English or Greek get, and the one members reading in Russian get. Both are
 * marked TEST in the subject so neither can be mistaken for the real thing.
 *
 * Owner only, like sending. A small allowance per owner stops a stuck button
 * from filling somebody's inbox.
 */
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 10;
const recent = new Map<string, number[]>();

export async function POST(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const data = await body<{
    to?: string;
    titleEn?: string;
    bodyEn?: string;
    titleEl?: string;
    bodyEl?: string;
    titleRu?: string;
    bodyRu?: string;
  }>(req);

  const to = (data?.to ?? "").trim().toLowerCase();
  if (!EMAIL.test(to)) {
    return NextResponse.json({ error: "TEST_BAD_EMAIL" }, { status: 400 });
  }

  /* The same limits as the real send, so a test never passes what the real
     notice would be refused for. */
  const title = (data?.titleEn ?? "").trim();
  const text = (data?.bodyEn ?? "").trim();
  if (title.length < 3 || text.length < 3) {
    return NextResponse.json({ error: "TOO_SHORT" }, { status: 400 });
  }
  if (title.length > 120 || text.length > 2000) {
    return NextResponse.json({ error: "TOO_LONG" }, { status: 400 });
  }

  const now = Date.now();
  const mine = (recent.get(gate.user.id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (mine.length >= PER_WINDOW) {
    return NextResponse.json({ error: "TEST_TOO_MANY" }, { status: 429 });
  }
  mine.push(now);
  recent.set(gate.user.id, mine);

  const url = "/account?tab=notifications";
  const en: Outgoing = { subject: title, body: text, url };
  const el: Outgoing | undefined =
    data?.titleEl?.trim() && data?.bodyEl?.trim()
      ? { subject: data.titleEl.trim(), body: data.bodyEl.trim(), url }
      : undefined;
  const ru: Outgoing | undefined =
    data?.titleRu?.trim() && data?.bodyRu?.trim()
      ? { subject: data.titleRu.trim(), body: data.bodyRu.trim(), url }
      : undefined;

  /* Exactly the letters deliverNotice would write: one for English and Greek
     readers, and one for Russian readers when there is Russian to send. */
  const letters = [forEmailParts({ en, el, ru }, "en")];
  if (ru) letters.push(forEmailParts({ en, el, ru }, "ru"));

  const transport = emailTransport();
  let sent = 0;
  const errors: string[] = [];
  for (const letter of letters) {
    const res = await transport
      .send(to, { ...letter, subject: `[TEST] ${letter.subject}` })
      .catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    if (res.ok) sent++;
    else errors.push(res.error);
  }

  if (sent === 0) {
    return NextResponse.json(
      { error: "TEST_FAILED", detail: errors[0] ?? "" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, sent, to, russian: Boolean(ru) });
}
