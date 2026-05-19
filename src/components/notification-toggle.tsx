"use client";

import { useEffect, useState, useCallback } from "react";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function NotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    setState(sub ? "on" : "off");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidRes = await fetch("/api/push/vapid");
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error("VAPID public key not configured");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });
      setState("on");
    } catch (err) {
      console.error("enable push error:", err);
      alert("通知の有効化に失敗しました");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === "loading") return null;
  if (state === "unsupported") return null;

  if (state === "denied") {
    return (
      <p className="text-xs text-[var(--muted)]">
        ブラウザの通知がブロックされています。設定から許可してください。
      </p>
    );
  }

  if (state === "on") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            const res = await fetch("/api/push/test", { method: "POST" });
            const data = await res.json();
            alert(JSON.stringify(data, null, 2));
          }}
          disabled={busy}
          className="text-xs bg-[var(--card)] border border-[var(--card-border)] text-white py-1.5 px-2 rounded-lg hover:border-[var(--accent)]"
        >
          テスト
        </button>
        <button
          onClick={disable}
          disabled={busy}
          className="text-xs text-[var(--muted)] hover:text-[var(--accent)] underline"
        >
          🔔 通知ON
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={busy}
      className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
    >
      {busy ? "..." : "🔔 通知を有効化"}
    </button>
  );
}
