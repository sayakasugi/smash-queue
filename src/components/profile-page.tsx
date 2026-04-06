"use client"

import { useState, useEffect } from "react"

type Props = {
  user: { id: string; name: string; xUsername: string }
  onClose: () => void
  onLogout: () => void
}

export function ProfilePage({ user, onClose, onLogout }: Props) {
  const [profile, setProfile] = useState<{ xUsername: string; name: string; createdAt: number; matchCount: number; tournamentCount: number } | null>(null)
  const [editName, setEditName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/auth/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProfile(data)
          setEditName(data.name)
        }
      })
  }, [])

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
