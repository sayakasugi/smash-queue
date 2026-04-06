"use client"

import { useState, useRef } from "react"
import { useAuth } from "./providers"
import { ProfilePage } from "@/components/profile-page"

export default function Home() {
  const { user, loading, login, logout } = useAuth()
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<"join" | "create">("join")
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [xUsername, setXUsername] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
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

  // Login / Register screen
  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">⚡ SmashQueue</h1>
            <p className="text-[var(--muted)] text-sm">スマブラ大会フリー対戦管理</p>
          </div>

          {/* Auth mode tabs */}
          <div className="flex bg-[var(--card)] rounded-xl p-1 border border-[var(--card-border)]">
            <button
              onClick={() => { setAuthMode("login"); setError("") }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${authMode === "login" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}
            >
              ログイン
            </button>
            <button
              onClick={() => { setAuthMode("register"); setError("") }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${authMode === "register" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}
            >
              新規登録
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setError("")
              setSubmitting(true)
              const res = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  xUsername,
                  password,
                  action: authMode === "register" ? "register" : "login",
                  name: displayName || undefined,
                }),
              })
              const data = await res.json()
              if (res.ok && data.user) {
                login(data.user.xUsername, data.user.name)
                window.location.reload()
              } else {
                setError(data.error || "エラーが発生しました")
              }
              setSubmitting(false)
            }}
            className="space-y-4 text-left"
          >
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">X（Twitter）ID</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">@</span>
                <input
                  type="text"
                  value={xUsername}
                  onChange={(e) => setXUsername(e.target.value.replace(/^@/, ""))}
                  placeholder="your_x_id"
                  className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-3.5 pl-10 pr-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
                />
              </div>
            </div>

            {authMode === "register" && (
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1.5">表示名（任意）</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="大会で表示される名前"
                  className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-3.5 px-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="4文字以上"
                className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-3.5 px-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
              />
            </div>

            {error && <p className="text-[var(--danger)] text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? "処理中..." : authMode === "login" ? "ログイン" : "登録する"}
            </button>
          </form>
        </div>
      </div>
    )
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
              @{user.xUsername}
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
