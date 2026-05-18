import webpush from "web-push";
import { supabase } from "./supabase";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const CONTACT = process.env.VAPID_CONTACT_EMAIL || "mailto:no-reply@example.com";

if (PUBLIC && PRIVATE) {
  webpush.setVapidDetails(CONTACT, PUBLIC, PRIVATE);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type StoredSubscription = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function getSubscriptionsForUsers(
  userIds: string[],
): Promise<StoredSubscription[]> {
  if (!userIds.length) return [];
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  return (data ?? []) as StoredSubscription[];
}

async function deleteSubscriptionById(id: number) {
  await supabase.from("push_subscriptions").delete().eq("id", id);
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (!PUBLIC || !PRIVATE) {
    console.warn("VAPID keys not configured; skipping push");
    return;
  }
  const subs = await getSubscriptionsForUsers(userIds);
  if (!subs.length) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (err: unknown) {
        const status =
          (err as { statusCode?: number })?.statusCode ??
          (err as { status?: number })?.status;
        if (status === 404 || status === 410) {
          await deleteSubscriptionById(sub.id);
        } else {
          console.error("push send error:", err);
        }
      }
    }),
  );
}
