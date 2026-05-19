import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { supabase } from "@/lib/supabase";

export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const hasPublic = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const hasPrivate = !!process.env.VAPID_PRIVATE_KEY;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, created_at")
    .eq("user_id", session.id);

  await sendPushToUsers([session.id], {
    title: "テスト通知",
    body: "通知が届けば成功です ✅",
    url: "/",
    tag: "test",
  });

  return NextResponse.json({
    sent: true,
    env: { hasPublic, hasPrivate },
    subscriptionCount: subs?.length ?? 0,
    subscriptions: subs ?? [],
  });
}
