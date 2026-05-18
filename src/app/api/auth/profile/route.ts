import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserProfile, updateUserProfile } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const profile = await getUserProfile(session.id);
  if (!profile)
    return NextResponse.json(
      { error: "ユーザーが見つかりません" },
      { status: 404 },
    );

  return NextResponse.json({
    xUsername: profile.x_username ?? "",
    name: profile.name,
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
    matchCount: profile.match_count,
    tournamentCount: profile.tournament_count,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { name, xUsername, onboarded } = await req.json();
  const { profile, error } = await updateUserProfile(session.id, {
    name,
    xUsername,
    onboarded,
  });
  if (!profile)
    return NextResponse.json(
      { error: error ?? "更新に失敗しました" },
      { status: 500 },
    );

  return NextResponse.json({ success: true });
}
