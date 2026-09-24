import { NextResponse } from "next/server";
import { body, owner } from "@/lib/api-guard";
import {
  addTeamMember,
  deleteTeamMember,
  listTeam,
  updateTeamMember,
} from "@/lib/team";

/**
 * The studio's team, edited from the desk. Owner only.
 *
 * Add, edit, hide and restore — never delete, so past classes keep the name of
 * whoever taught them. Every write answers with the fresh list.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await owner();
  if ("res" in gate) return gate.res;
  return NextResponse.json({ team: listTeam() });
}

export async function POST(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{
    name?: string;
    bioEn?: string;
    bioEl?: string;
    photoUrl?: string;
  }>(req);

  const result = addTeamMember({
    name: String(d?.name ?? ""),
    bioEn: d?.bioEn,
    bioEl: d?.bioEl,
    photoUrl: d?.photoUrl,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true, team: listTeam() });
}

export async function PATCH(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{
    id?: string;
    name?: string;
    bioEn?: string;
    bioEl?: string;
    photoUrl?: string;
    active?: boolean;
  }>(req);
  if (!d?.id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const patch: Parameters<typeof updateTeamMember>[1] = {};
  if (d.name !== undefined) patch.name = d.name;
  if (d.bioEn !== undefined) patch.bioEn = d.bioEn;
  if (d.bioEl !== undefined) patch.bioEl = d.bioEl;
  if (d.photoUrl !== undefined) patch.photoUrl = d.photoUrl;
  if (d.active !== undefined) patch.active = d.active;

  const result = updateTeamMember(d.id, patch);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code },
      { status: result.code === "NOT_FOUND" ? 404 : 400 },
    );
  }
  return NextResponse.json({ ok: true, team: listTeam() });
}

export async function DELETE(req: Request) {
  const gate = await owner();
  if ("res" in gate) return gate.res;

  const d = await body<{ id?: string }>(req);
  if (!d?.id) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const result = deleteTeamMember(d.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 404 });
  }
  return NextResponse.json({ ok: true, team: listTeam() });
}
