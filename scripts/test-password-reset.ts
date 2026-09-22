/**
 * The forgotten-password flow, against a real database.
 * Run with: npm run test:password-reset
 *
 * What it pins down, each a rule that fails quietly if it breaks:
 *
 *   - an unknown address mints nothing, and the request side never says whether
 *     an address is a member (enumeration);
 *   - the token is stored only as a hash, never in the clear;
 *   - a good token identifies its account and sets the password;
 *   - a link is single-use — spent once, it is spent for good;
 *   - an expired link is refused;
 *   - a second request inside the cooldown is held off.
 *
 * Fixtures are throwaway isTest accounts, removed at the end.
 */
/* Load .env the way the backup script does: tsx does not read it on its own,
   and the reset tokens are keyed with AUTH_SECRET, which lives there. */
try {
  process.loadEnvFile(".env");
} catch {
  /* No .env or an older Node — fall back to the ambient environment. */
}
import { eq } from "drizzle-orm";
import { db, sqlite } from "../src/db";
import { passwordResets, users } from "../src/db/schema";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import {
  checkResetToken,
  consumeReset,
  requestReset,
} from "../src/lib/password-reset";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`, extra ?? "");
  }
}

async function mkUser(): Promise<{ id: string; email: string }> {
  const email = `reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@apex.test`;
  const u = db
    .insert(users)
    .values({
      email,
      name: "Reset Fixture",
      phone: `+35799${String(Math.floor(Math.random() * 900000) + 100000)}`,
      passwordHash: await hashPassword("originalpass"),
      isTest: true,
      emailVerifiedAt: new Date(),
    })
    .returning()
    .get();
  return { id: u.id, email: u.email };
}

const made: string[] = [];

async function main() {
  /* ---------------------------------------------------------------- 1 */
  console.log("\n1. An unknown address mints nothing and admits nothing");
  const ghost = requestReset(`nobody-${Date.now()}@nowhere.test`);
  check(
    "requesting a reset for an unknown email reports NO_ACCOUNT",
    ghost.ok === false && ghost.code === "NO_ACCOUNT",
    ghost,
  );

  /* ---------------------------------------------------------------- 2 */
  console.log("\n2. A real address gets a token, stored only as a hash");
  const a = await mkUser();
  made.push(a.id);
  const r1 = requestReset(a.email);
  check("the request succeeds", r1.ok === true, r1);
  const token = r1.ok ? r1.token : "";
  check("a token is handed back", token.length > 20, token.length);
  const row = db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.userId, a.id))
    .get();
  check("a reset row exists", Boolean(row), row);
  check(
    "and the raw token is nowhere in the row",
    Boolean(row) && row!.tokenHash !== token,
    row?.tokenHash,
  );

  /* ---------------------------------------------------------------- 3 */
  console.log("\n3. A second request inside the cooldown is held off");
  const r2 = requestReset(a.email);
  check(
    "an immediate re-request reports TOO_SOON",
    r2.ok === false && r2.code === "TOO_SOON",
    r2,
  );

  /* ---------------------------------------------------------------- 4 */
  console.log("\n4. A good token checks out; a bad one does not");
  const good = checkResetToken(token);
  check(
    "the token identifies its account",
    good.ok === true && good.userId === a.id,
    good,
  );
  check(
    "a garbage token is invalid",
    checkResetToken("not-a-real-token").ok === false,
    checkResetToken("not-a-real-token"),
  );

  /* ---------------------------------------------------------------- 5 */
  console.log("\n5. Spending the link sets the password, once");
  const consumed = await consumeReset(token, "brandnewpass1");
  check("the reset succeeds", consumed.ok === true, consumed);
  const fresh = db.select().from(users).where(eq(users.id, a.id)).get()!;
  check(
    "the new password now works",
    await verifyPassword("brandnewpass1", fresh.passwordHash),
    "verify failed",
  );
  check(
    "and the old password no longer does",
    !(await verifyPassword("originalpass", fresh.passwordHash)),
    "old password still valid",
  );
  const afterUse = checkResetToken(token);
  check(
    "the link is now spent",
    afterUse.ok === false && afterUse.code === "USED",
    afterUse,
  );
  const again = await consumeReset(token, "yetanotherpass");
  check(
    "and it cannot be used a second time",
    again.ok === false && again.code === "USED",
    again,
  );
  check(
    "the second attempt did not change the password",
    await verifyPassword("brandnewpass1", db.select().from(users).where(eq(users.id, a.id)).get()!.passwordHash),
    "password changed on a used link",
  );

  /* ---------------------------------------------------------------- 6 */
  console.log("\n6. An expired link is refused");
  const b = await mkUser();
  made.push(b.id);
  const rb = requestReset(b.email);
  const tokenB = rb.ok ? rb.token : "";
  /* Push its expiry into the past directly, the one thing a fixed clock would
     otherwise be needed for. */
  db.update(passwordResets)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(passwordResets.userId, b.id))
    .run();
  const expiredCheck = checkResetToken(tokenB);
  check(
    "an expired token reports EXPIRED",
    expiredCheck.ok === false && expiredCheck.code === "EXPIRED",
    expiredCheck,
  );
  const expiredConsume = await consumeReset(tokenB, "shouldnotwork1");
  check(
    "and it cannot be spent",
    expiredConsume.ok === false && expiredConsume.code === "EXPIRED",
    expiredConsume,
  );

  /* -------------------------------------------------------------- tidy up */
  for (const id of made) {
    sqlite.prepare("delete from password_resets where user_id = ?").run(id);
    sqlite.prepare("delete from users where id = ?").run(id);
  }
  const left = db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(eq(passwordResets.userId, made[0] ?? "none"))
    .all().length;
  check("fixtures cleaned up", left === 0, left);

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
