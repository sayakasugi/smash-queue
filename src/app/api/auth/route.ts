import { NextResponse } from "next/server";
import { getSession, signOut } from "@/lib/auth";

// GET: セッション確認
export async function GET() {
  const user = await getSession();
  return NextResponse.json({ user: user || null });
}

// DELETE: ログアウト
export async function DELETE() {
  await signOut();
  return NextResponse.json({ success: true });
}
