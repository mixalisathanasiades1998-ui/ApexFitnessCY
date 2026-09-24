import { NextResponse } from "next/server";
import { body, owner } from "@/lib/api-guard";
import {
  createPack,
  deletePack,
  listPacks,
  updatePack,
} from "@/lib/catalogue-desk";

/**
 * The price list, edited from the desk. Owner only — a receptionist can sell a
 * pack but not reprice one.
 *
 * The rules live in catalogue-desk; this is the gate and the shape of the
 * request. Every write answers with the fresh list so the panel redraws from
 * the server rather than trusting what it just sent.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await owner();
  if ("res" in gate) return gate.res;
  return NextResponse.json({ packs: listPacks() });
}

export async function POST(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{
    nameEn?: string;
    nameEl?: string;
    credits?: number;
    priceCents?: number;
    validityDays?: number;
    group?: string;
  }>(req);

  const result = createPack({
    nameEn: String(d?.nameEn ?? ""),
    nameEl: String(d?.nameEl ?? ""),
    credits: Number(d?.credits),
    priceCents: Number(d?.priceCents),
    validityDays: Number(d?.validityDays),
    group: String(d?.group ?? ""),
  });
  if (!result.ok) return NextResponse.json({ error: result.code }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.pack.id, packs: listPacks() });
}

export async function PATCH(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{
    id?: string;
    nameEn?: string;
    nameEl?: string;
    credits?: number;
    priceCents?: number;
    validityDays?: number;
    group?: string;
    active?: boolean;
  }>(req);
  if (!d?.id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const patch: Parameters<typeof updatePack>[1] = {};
  if (d.nameEn !== undefined) patch.nameEn = d.nameEn;
  if (d.nameEl !== undefined) patch.nameEl = d.nameEl;
  if (d.credits !== undefined) patch.credits = Number(d.credits);
  if (d.priceCents !== undefined) patch.priceCents = Number(d.priceCents);
  if (d.validityDays !== undefined) patch.validityDays = Number(d.validityDays);
  if (d.group !== undefined) patch.group = d.group;
  if (d.active !== undefined) patch.active = d.active;

  const result = updatePack(d.id, patch);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code },
      { status: result.code === "NOT_FOUND" ? 404 : 400 },
    );
  }
  return NextResponse.json({ ok: true, packs: listPacks() });
}

export async function DELETE(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{ id?: string }>(req);
  if (!d?.id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const result = deletePack(d.id);
  if (!result.ok) {
    /* A sold pack cannot be deleted — its row still names members' purchases and
       invoices. 409, so the panel can say "take it off sale instead". */
    return NextResponse.json(
      { error: result.code },
      { status: result.code === "SOLD" ? 409 : 404 },
    );
  }
  return NextResponse.json({ ok: true, packs: listPacks() });
}
