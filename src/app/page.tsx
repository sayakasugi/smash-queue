"use client"

import { useState } from "react"
import { useAuth } from "./providers"

export default function Home() {
  const { user, loading, login, logout } = useAuth()
  const [xUsername, setXUsername] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [mode, setMode] = useState<"join" | "create">("join")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!xUsername.trim()) return
              const ok = await login(xUsername.trim())
              if (!ok) setError("エラーが発生しました")
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm text-[var(--muted)] mb-2 text-left">X（Twitter）IDを入力</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">@</span>
                <input
                  type="text"
                  value={xUsername}
                  onChange={(e) => setXUsername(e.target.value.replace(/^@/, ""))}
                  placeholder="your_x_id"
                  className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white py-4 pl-10 pr-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
                />
              </div>
            </div>
            {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-4 rounded-xl transition-colors"
            >
              はじめる
            </button>
          </form>
          <p className="text-xs text-[var(--muted)]">※ 名前クリックで相手のXプロフィールを確認できます</p>
        </div>
      </div>
    )
  }

  // Main screen
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    try {
      if (mode === "join") {
        const res = await fetch("/api/tournaments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join", code: code.toUpperCase() }),
        })
        if (!res.ok) {
          setError("大会が見つかりません。コードを確認してください。")
          setSubmitting(false)
          return
        }
        const tournament = await res.json()
        window.location.href = `/tournament/${tournament.id}`
      } else {
        if (!name.trim()) {
          setError("大会名を入力してください")
          setSubmitting(false)
          return
        }
        const res = await fetch("/api/tournaments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", name: name.trim() }),
        })
        const tournament = await res.json()
        window.location.href = `/tournament/${tournament.id}`
      }
    } catch {
      setError("エラーが発生しました")
    }
    setSubmitting(false)
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">⚡ SmashQueue</h1>
          <p className="text-[var(--muted)] text-sm">
            ログイン中:{" "}
            <a href={`https://x.com/${user.xUsername}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              @{user.xUsername}
            </a>
            <button onClick={logout} className="ml-3 text-xs text-[var(--danger)] hover:underline">ログアウト</button>
          </p>
        </div>

        {/* Tab */}
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
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="大会コードを入力"
              maxLength={6}
              className="w-full bg-[var(--card)] border border-[var(--card-border)] text-white text-center text-2xl font-mono tracking-[0.3em] py-4 rounded-xl focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)] placeholder:text-base placeholder:tracking-normal"
            />
          ) : (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
