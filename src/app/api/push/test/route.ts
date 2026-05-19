import { NextResponse } from "next/server";
import webpush from "web-push";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const CONTACT = process.env.VAPID_CONTACT_EMAIL || "mailto:no-reply@example.com";

if (PUBLIC && PRIVATE) {
  webpush.setVapidDetails(CONTACT, PUBLIC, PRIVATE);
}

export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const hasPublic = !!PUBLIC;
  const hasPrivate = !!PRIVATE;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, created_at")
    .eq("user_id", session.id);

  const results: Array<{
    id: number;
    endpointHost: string;
    success: boolean;
    statusCode?: number;
    body?: string;
    error?: string;
  }> = [];

  for (const sub of subs ?? []) {
    const endpointHost = new URL(sub.endpoint).host;
    try {
      const result = await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: "テスト通知",
          body: "通知が届けば成功です ✅",
          url: "/",
          tag: "test",
        }),
      );
      results.push({
        id: sub.id,
        endpointHost,
        success: true,
        statusCode: result.statusCode,
        body: result.body,
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; body?: string; message?: string };
      results.push({
        id: sub.id,
        endpointHost,
        success: false,
        statusCode: e.statusCode,
        body: e.body,
        error: e.message ?? String(err),
      });
    }
  }

  return NextResponse.json({
    env: { hasPublic, hasPrivate, publicKeyPrefix: PUBLIC?.slice(0, 16) },
    subscriptionCount: subs?.length ?? 0,
    results,
  });
}
