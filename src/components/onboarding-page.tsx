"use client";

import { useState } from "react";

type Props = {
  user: { id: string; name: string; xUsername: string };
};

export function OnboardingPage({ user }: Props) {
  const [displayName, setDisplayName] = useState(user.name);
  const [xUsername, setXUsername] = useState(user.xUsername);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = displayName.trim();
    if (!name) {
      setError("表示名を入力してください");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        xUsername: xUsername.replace(/^@/, "").trim(),
        onboarded: true,
      }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ? `保存失敗: ${body.error}` : "保存に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">⚡ SmashQueue</h1>
          <p className="text-[var(--muted)] text-sm">プロフィール設定</p>
        </div>

        <p className="text-sm text-[var(--muted)] text-center">
          他のプレイヤーに表示される名前を設定してください
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5">
              表示名 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例: スマブラ太郎"
              autoFocus
              className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-3 px-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5">
              X（Twitter）ID
              <span className="text-[var(--muted)]">（任意）</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                @
              </span>
              <input
                type="text"
                value={xUsername}
                onChange={(e) =>
                  setXUsername(e.target.value.replace(/^@/, ""))
                }
                placeholder="your_x_id"
                className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-3 pl-10 pr-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
              />
            </div>
          </div>

          {error && (
            <p className="text-[var(--danger)] text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? "保存中..." : "はじめる"}
          </button>
        </form>
      </div>
    </div>
  );
}
