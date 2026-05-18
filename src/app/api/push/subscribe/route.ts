import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// POST: register a push subscription for the current user
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { subscription, userAgent } = (await req.json()) as {
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    userAgent?: string;
  };

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "不正な購読情報" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: session.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    console.error("push subscribe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE: remove a subscription by endpoint
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { endpoint } = (await req.json()) as { endpoint: string };
  if (!endpoint)
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  const supabase = await createClient();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", session.id)
    .eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
