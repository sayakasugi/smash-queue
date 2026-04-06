"use client"

import { useState, useRef } from "react"
import { useAuth } from "./providers"

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

// === Profile Page ===

function ProfilePage({ user, onClose, onLogout }: { user: { id: string; name: string; xUsername: string }; onClose: () => void; onLogout: () => void }) {
  const [profile, setProfile] = useState<{ xUsername: string; name: string; createdAt: number; matchCount: number; tournamentCount: number } | null>(null)
  const [editName, setEditName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useState(() => {
    fetch("/api/auth/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProfile(data)
          setEditName(data.name)
        }
      })
  })

  async function saveProfile() {
    setSaving(true)
    setMessage("")
    const body: { name?: string; password?: string } = {}
    if (editName && editName !== profile?.name) body.name = editName
    if (newPassword) body.password = newPassword
    if (Object.keys(body).length === 0) { setSaving(false); setEditing(false); return }

    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setMessage("保存しました")
      setEditing(false)
      setNewPassword("")
      if (body.name) setProfile(prev => prev ? { ...prev, name: body.name! } : prev)
    } else {
      setMessage("エラーが発生しました")
    }
    setSaving(false)
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">プロフィール</h2>
          <button onClick={onClose} className="text-sm text-[var(--muted)] hover:text-white">← 戻る</button>
        </div>

        {/* Avatar */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto bg-[var(--accent)]/20 rounded-full flex items-center justify-center text-3xl font-bold text-[var(--accent)]">
            {(profile?.name || user.xUsername)[0]?.toUpperCase()}
          </div>
          <a
            href={`https://x.com/${user.xUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline text-sm mt-3 inline-block"
          >
            @{user.xUsername}
          </a>
        </div>

        {/* Stats */}
        {profile && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{profile.matchCount || 0}</p>
              <p className="text-xs text-[var(--muted)] mt-1">対戦数</p>
            </div>
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{profile.tournamentCount || 0}</p>
              <p className="text-xs text-[var(--muted)] mt-1">参加大会</p>
            </div>
          </div>
        )}

        {/* Edit */}
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">表示名</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-3 px-4 rounded-xl focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1.5">新しいパスワード（変更する場合）</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="変更しない場合は空欄"
                className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-3 px-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={saveProfile} disabled={saving} className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
              <button onClick={() => { setEditing(false); setNewPassword("") }} className="flex-1 bg-[var(--card)] border border-[var(--card-border)] text-white font-semibold py-3 rounded-xl hover:border-[var(--accent)] transition-colors">
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
              <p className="text-xs text-[var(--muted)] mb-1">表示名</p>
              <p className="font-semibold">{profile?.name || user.name}</p>
            </div>
            {profile && (
              <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                <p className="text-xs text-[var(--muted)] mb-1">登録日</p>
                <p className="text-sm">{new Date(profile.createdAt).toLocaleDateString("ja-JP")}</p>
              </div>
            )}
            <button onClick={() => setEditing(true)} className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white font-semibold py-3 rounded-xl hover:border-[var(--accent)] transition-colors">
              プロフィールを編集
            </button>
          </div>
        )}

        {message && <p className="text-sm text-center text-[var(--accent)]">{message}</p>}

        <button onClick={onLogout} className="w-full text-sm text-[var(--danger)] hover:underline py-2">
          ログアウト
        </button>
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
