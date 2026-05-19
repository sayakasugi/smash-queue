"use client"

import { useState, useRef } from "react"
import { useAuth } from "./providers"
import { ProfilePage } from "@/components/profile-page"
import { OnboardingPage } from "@/components/onboarding-page"

export default function Home() {
  const { user, loading, signInWithGoogle, logout } = useAuth()
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<"join" | "create">("join")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-[var(--muted)]">読み込み中...</div>
      </div>
    )
  }

  // Login screen
  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">⚡ SmashQueue</h1>
            <p className="text-[var(--muted)] text-sm">スマブラ大会フリー対戦管理</p>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-4 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Googleでサインイン
          </button>

          <p className="text-xs text-[var(--muted)]">初めての方も、サインインで自動的にアカウントが作成されます</p>

          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 text-left space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              📱 ホーム画面に追加すると便利
            </p>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              アプリとしてインストールすると、対戦の呼び出しやマッチ成立を<strong className="text-foreground">通知</strong>で受け取れます。
            </p>
            <ul className="text-xs text-[var(--muted)] space-y-1 pl-1">
              <li>
                <strong className="text-foreground">iPhone:</strong> Safariで開き、共有 → 「ホーム画面に追加」
              </li>
              <li>
                <strong className="text-foreground">Android:</strong> Chromeメニュー → 「ホーム画面に追加」
              </li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // First-time onboarding (show display name setup before main app)
  if (!user.onboarded) {
    return <OnboardingPage user={user} />
  }

  // Profile modal
  if (showProfile) {
    return <ProfilePage user={user} onClose={() => setShowProfile(false)} onLogout={logout} />
  }

  // Main screen
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      if (mode === "join") {
        const codeVal = (codeRef.current?.value || "").replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
        if (!codeVal) { setError("コードを入力してください"); setSubmitting(false); return }
        const res = await fetch("/api/tournaments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join", code: codeVal }),
        })
        if (!res.ok) { setError("大会が見つかりません"); setSubmitting(false); return }
        const tournament = await res.json()
        window.location.href = `/tournament/${tournament.id}`
      } else {
        const nameVal = nameRef.current?.value?.trim() || ""
        if (!nameVal) { setError("大会名を入力してください"); setSubmitting(false); return }
        const res = await fetch("/api/tournaments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", name: nameVal }),
        })
        const tournament = await res.json()
        window.location.href = `/tournament/${tournament.id}`
      }
    } catch { setError("エラーが発生しました") }
    setSubmitting(false)
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">⚡ SmashQueue</h1>
          <div className="flex items-center justify-center gap-3 text-sm">
            <button onClick={() => setShowProfile(true)} className="text-[var(--accent)] hover:underline">
              {user.name}{user.xUsername ? ` (@${user.xUsername})` : ""}
            </button>
            <button onClick={logout} className="text-xs text-[var(--danger)] hover:underline">ログアウト</button>
          </div>
        </div>

        <div className="flex bg-[var(--card)] rounded-xl p-1 border border-[var(--card-border)]">
          <button
            onClick={() => { setMode("join"); setError("") }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === "join" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}
          >
            大会に参加
          </button>
          <button
            onClick={() => { setMode("create"); setError("") }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === "create" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}
          >
            大会を作成
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "join" ? (
            <input
              ref={codeRef}
              type="text"
              placeholder="大会コードを入力"
              maxLength={6}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              style={{ textTransform: "uppercase" }}
              className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white text-center text-2xl font-mono tracking-[0.3em] py-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)] placeholder:text-base placeholder:tracking-normal"
            />
          ) : (
            <input
              ref={nameRef}
              type="text"
              placeholder="大会名を入力"
              className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-4 px-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
            />
          )}
          {error && <p className="text-[var(--danger)] text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? "処理中..." : mode === "join" ? "参加する" : "作成する"}
          </button>
        </form>

        <MyTournaments />
      </div>
    </div>
  )
}

// === My Tournaments ===

function MyTournaments() {
  const [tournaments, setTournaments] = useState<{ id: string; name: string; code: string }[]>([])
  const [loaded, setLoaded] = useState(false)

  if (!loaded) {
    return (
      <button
        onClick={async () => {
          const res = await fetch("/api/tournaments")
          if (res.ok) setTournaments(await res.json())
          setLoaded(true)
        }}
        className="w-full text-center text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
      >
        過去の大会を表示
      </button>
    )
  }

  if (tournaments.length === 0) {
    return <p className="text-center text-sm text-[var(--muted)]">参加済みの大会はありません</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--muted)] mb-2">参加済みの大会</p>
      {tournaments.map((t) => (
        <a
          key={t.id}
          href={`/tournament/${t.id}`}
          className="block bg-[var(--card)] border border-[var(--card-border)] hover:border-[var(--accent)] rounded-xl p-4 transition-colors"
        >
          <p className="font-semibold text-sm">{t.name}</p>
          <p className="text-xs text-[var(--muted)] mt-1">コード: {t.code}</p>
        </a>
      ))}
    </div>
  )
}
