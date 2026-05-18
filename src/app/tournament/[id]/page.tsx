"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "../../providers"
import { ProfilePage } from "@/components/profile-page"
import { NotificationToggle } from "@/components/notification-toggle"
import { useSetups, useSetupDetail, useMyStatus, useMatchNotification } from "@/hooks/use-realtime"

type Tournament = { id: string; name: string; code: string; organizer_id: string }
type Player = { id: string; name: string; xUsername: string }
type Setup = { id: string; name: string; status: string; tournament_id: string }
type Match = {
  id: string; setup_id: string;
  player1_id: string; player1_name: string; player1_x: string;
  player2_id: string; player2_name: string; player2_x: string;
  started_at: string; ends_at: string; status: string;
  player1_ready: boolean; player2_ready: boolean;
}
type QueueEntry = {
  id: string;
  player1_id: string; player1_name: string; player1_x: string;
  player2_id: string; player2_name: string; player2_x: string;
  position: number; status: string;
}
type Recruitment = {
  id: string; setup_id: string;
  creator_id: string; creator_name: string; creator_x: string;
  template: string; description: string; expires_at: string | null; status: string;
}

function matchPlayer1(m: Match): Player {
  return { id: m.player1_id, name: m.player1_name, xUsername: m.player1_x }
}
function matchPlayer2(m: Match): Player {
  return { id: m.player2_id, name: m.player2_name, xUsername: m.player2_x }
}
function queuePlayer1(e: QueueEntry): Player {
  return { id: e.player1_id, name: e.player1_name, xUsername: e.player1_x }
}
function queuePlayer2(e: QueueEntry): Player {
  return { id: e.player2_id, name: e.player2_name, xUsername: e.player2_x }
}
function recruitmentCreator(r: Recruitment): Player {
  return { id: r.creator_id, name: r.creator_name, xUsername: r.creator_x }
}

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>()
  const { user, logout } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [selectedSetup, setSelectedSetup] = useState<string | null>(null)
  const [newSetupName, setNewSetupName] = useState("")
  const [batchFrom, setBatchFrom] = useState("")
  const [batchTo, setBatchTo] = useState("")
  const [addMode, setAddMode] = useState<"single" | "batch">("single")
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedSetupIds, setSelectedSetupIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [templates, setTemplates] = useState<string[]>([])
  const [templateText, setTemplateText] = useState("")
  const [templateLoading, setTemplateLoading] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showTimerSettings, setShowTimerSettings] = useState(false)
  const [timerSettings, setTimerSettings] = useState({ matchDuration: 30, recruitmentExpiry: 10, callingTimeout: 5, fiveMinWarning: 5, penaltyDuration: 10 })
  const [timerLoading, setTimerLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const xId = user?.id || ""
  const isOrganizer = tournament?.organizer_id === xId

  // Realtime setups
  const { setups: realtimeSetups, recruitCounts, refetch: refetchSetups } = useSetups(id)
  const setups = realtimeSetups as (Setup & Record<string, unknown>)[]

  // Fetch tournament
  useEffect(() => {
    fetch(`/api/tournaments/${id}`)
      .then(r => { if (r.ok) return r.json(); return null })
      .then(data => {
        if (data) {
          setTournament(data)
        } else {
          // Tournament not found — redirect home
          window.location.href = "/"
        }
      })
      .catch(() => { window.location.href = "/" })
  }, [id])

  // Add setup (single)
  async function addSetup() {
    if (!newSetupName.trim()) return
    await fetch(`/api/tournaments/${id}/setups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSetupName.trim() }),
    })
    setNewSetupName("")
    refetchSetups()
  }

  // Add setups (batch)
  async function addBatchSetups() {
    const from = Number(batchFrom)
    const to = Number(batchTo)
    if (isNaN(from) || isNaN(to) || from > to) return
    await fetch(`/api/tournaments/${id}/setups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, prefix: "台" }),
    })
    setBatchFrom("")
    setBatchTo("")
    refetchSetups()
  }

  // Bulk operations
  function toggleSelectSetup(setupId: string) {
    setSelectedSetupIds(prev => {
      const next = new Set(prev)
      if (next.has(setupId)) next.delete(setupId)
      else next.add(setupId)
      return next
    })
  }

  function selectAllSetups() {
    if (selectedSetupIds.size === setups.length) {
      setSelectedSetupIds(new Set())
    } else {
      setSelectedSetupIds(new Set(setups.map(s => s.id)))
    }
  }

  async function bulkAction(action: "enable" | "disable" | "delete") {
    if (selectedSetupIds.size === 0) return
    const ids = Array.from(selectedSetupIds)

    if (action === "delete") {
      if (!confirm(`${ids.length}台を削除しますか？`)) return
      for (const sid of ids) {
        await fetch(`/api/tournaments/${id}/setups`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setupId: sid }),
        })
      }
    } else {
      await fetch(`/api/tournaments/${id}/setups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupIds: ids, disabled: action === "disable" }),
      })
    }

    setSelectedSetupIds(new Set())
    setBulkMode(false)
    refetchSetups()
  }

  // Toggle setup disabled
  async function toggleSetup(setupId: string, currentStatus: string) {
    await fetch(`/api/tournaments/${id}/setups`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupId, disabled: currentStatus !== "disabled" }),
    })
    refetchSetups()
  }

  // Delete setup
  async function removeSetup(setupId: string) {
    if (!confirm("この台を削除しますか？")) return
    await fetch(`/api/tournaments/${id}/setups`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupId }),
    })
    if (selectedSetup === setupId) setSelectedSetup(null)
    refetchSetups()
  }

  // Timer settings
  async function openTimerSettings() {
    const res = await fetch(`/api/tournaments/${id}/settings`)
    if (res.ok) setTimerSettings(await res.json())
    setShowTimerSettings(true)
  }

  async function saveTimerSettings() {
    setTimerLoading(true)
    await fetch(`/api/tournaments/${id}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(timerSettings),
    })
    setShowTimerSettings(false)
    setTimerLoading(false)
  }

  // Fetch templates
  async function openTemplateEditor() {
    const res = await fetch(`/api/tournaments/${id}/templates`)
    if (res.ok) {
      const t = await res.json()
      setTemplates(t)
      setTemplateText(t.join("\n"))
    }
    setShowTemplateEditor(true)
  }

  async function saveTemplateChanges() {
    setTemplateLoading(true)
    const list = templateText.split("\n").map(s => s.trim()).filter(Boolean)
    await fetch(`/api/tournaments/${id}/templates`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates: list }),
    })
    setTemplates(list)
    setShowTemplateEditor(false)
    setTemplateLoading(false)
  }

  // Notification sound
  function playSound() {
    if (!audioRef.current) {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdXeIkpWTj4J1aF9naXZ/iIuLiYN8dXBwdXuBhoiIhoJ9eHV0dnh8gIOFhYSDgH17enp7fX+Bg4OEg4GAf357e3x9foCBgoKCgoGAf397fHx9fYCBgoKCgoGAf359fHx9foCAgoKBgYGAf359fHx9fn+AgYGBgYGAf359fHx9fn+AgYGBgYF/f359fHx9fn+AgIGBgYGAf359fHx9fn+AgYGBgYF/f359fX1+f4CAgYGBgIB/fn19fX5+f4CAgYGBgIB/fn19fX5+f4CAgYGBgIB/fn59fX5+f4CAgICBgIB/fn59fX1+f4CAgICBgIB/fn59fX5+f4CAgICBgIB/fn59fX5+f4CAgICAgIB/fn59fX5+f4CAgICAgIB/fn59fX5+")
    }
    audioRef.current.play().catch(() => {})
  }

  if (!tournament) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-[var(--muted)]">読み込み中...</div>
      </div>
    )
  }

  if (showProfile && user) {
    return <ProfilePage user={user} onClose={() => setShowProfile(false)} onLogout={logout} />
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-[var(--card)] border-b border-[var(--card-border)] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">{tournament.name}</h1>
            <p className="text-xs text-[var(--muted)]">コード: <span className="font-mono text-[var(--accent)]">{tournament.code}</span></p>
          </div>
          <div className="flex items-center gap-3">
            {isOrganizer && (
              <>
                <button onClick={openTimerSettings} className="text-xs text-[var(--accent)] hover:underline">時間設定</button>
                <button onClick={openTemplateEditor} className="text-xs text-[var(--accent)] hover:underline">テンプレート</button>
              </>
            )}
            <NotificationToggle />
            <button onClick={() => setShowProfile(true)} className="text-xs text-[var(--accent)] hover:underline">@{user?.xUsername}</button>
            <a href="/" className="text-sm text-[var(--muted)] hover:text-white">← 戻る</a>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar: Setup list (hide on mobile when setup is selected) */}
          <div className={`space-y-4 ${selectedSetup ? "hidden lg:block" : ""}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">台一覧</h2>
              {isOrganizer && setups.length > 0 && (
                <button
                  onClick={() => { setBulkMode(!bulkMode); setSelectedSetupIds(new Set()) }}
                  className={`text-xs transition-colors ${bulkMode ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-white"}`}
                >
                  {bulkMode ? "完了" : "一括操作"}
                </button>
              )}
            </div>

            {/* Bulk action bar */}
            {bulkMode && (
              <div className="space-y-2">
                <button onClick={selectAllSetups} className="text-xs text-[var(--accent)] hover:underline">
                  {selectedSetupIds.size === setups.length ? "選択解除" : "すべて選択"}（{selectedSetupIds.size}/{setups.length}）
                </button>
                {selectedSetupIds.size > 0 && (
                  <div className="flex gap-2">
                    <button onClick={() => bulkAction("enable")} className="flex-1 text-xs bg-green-500/20 text-green-400 py-2 rounded-lg hover:bg-green-500/30 transition-colors">有効</button>
                    <button onClick={() => bulkAction("disable")} className="flex-1 text-xs bg-yellow-500/20 text-yellow-400 py-2 rounded-lg hover:bg-yellow-500/30 transition-colors">使用不可</button>
                    <button onClick={() => bulkAction("delete")} className="flex-1 text-xs bg-red-500/20 text-red-400 py-2 rounded-lg hover:bg-red-500/30 transition-colors">削除</button>
                  </div>
                )}
              </div>
            )}

            {/* Add setup (organizer only) */}
            {isOrganizer && (
              <div className="space-y-2">
                <div className="flex gap-1 bg-[var(--card)] rounded-lg p-0.5 border border-[var(--card-border)]">
                  <button onClick={() => setAddMode("single")} className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${addMode === "single" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>個別追加</button>
                  <button onClick={() => setAddMode("batch")} className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${addMode === "batch" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>一括追加</button>
                </div>
                {addMode === "single" ? (
                  <div className="flex gap-2">
                    <input type="text" value={newSetupName} onChange={(e) => setNewSetupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSetup()} placeholder="台名（例: 台1）" className="flex-1 bg-[var(--card)] border border-[var(--card-border)] text-white text-sm py-2 px-3 rounded-lg focus:outline-none focus:border-[var(--accent)]" />
                    <button onClick={addSetup} className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm px-3 py-2 rounded-lg transition-colors">追加</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-[var(--muted)]">台</span>
                      <input type="number" value={batchFrom} onChange={(e) => setBatchFrom(e.target.value)} placeholder="1" className="w-16 bg-[var(--card)] border border-[var(--card-border)] text-white text-sm py-2 px-2 rounded-lg text-center focus:outline-none focus:border-[var(--accent)]" />
                      <span className="text-xs text-[var(--muted)]">〜</span>
                      <input type="number" value={batchTo} onChange={(e) => setBatchTo(e.target.value)} placeholder="10" className="w-16 bg-[var(--card)] border border-[var(--card-border)] text-white text-sm py-2 px-2 rounded-lg text-center focus:outline-none focus:border-[var(--accent)]" />
                    </div>
                    <button onClick={addBatchSetups} className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm px-3 py-2 rounded-lg transition-colors">一括追加</button>
                  </div>
                )}
              </div>
            )}

            {/* Setup cards */}
            {setups.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">台がまだありません</p>
            ) : (
              setups.map((setup) => {
                const currentMatchId = (setup as Record<string, unknown>).current_match_id as string | null
                return (
                <button
                  key={setup.id}
                  onClick={() => bulkMode ? toggleSelectSetup(setup.id) : setSelectedSetup(setup.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    bulkMode && selectedSetupIds.has(setup.id)
                      ? "bg-[var(--accent)]/20 border-[var(--accent)]"
                      : selectedSetup === setup.id && !bulkMode
                      ? "bg-[var(--accent)]/10 border-[var(--accent)]"
                      : "bg-[var(--card)] border-[var(--card-border)] hover:border-[var(--accent)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {bulkMode && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${selectedSetupIds.has(setup.id) ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--muted)]"}`}>
                          {selectedSetupIds.has(setup.id) && "✓"}
                        </div>
                      )}
                      <span className="font-semibold text-sm">{setup.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      setup.status === "disabled" ? "bg-gray-500/20 text-gray-400" :
                      setup.status === "idle" ? "bg-green-500/20 text-green-400" :
                      setup.status === "calling" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {setup.status === "disabled" ? "使用不可" : setup.status === "idle" ? "空き" : setup.status === "calling" ? "呼出中" : "使用中"}
                    </span>
                  </div>
                  {currentMatchId && (
                    <p className="text-xs text-[var(--muted)] mt-2">
                      対戦中
                    </p>
                  )}
                  {(recruitCounts[setup.id] || 0) > 0 && (
                    <p className="text-xs text-[var(--accent)] mt-1">📢 募集中: {recruitCounts[setup.id]}件</p>
                  )}
                  {isOrganizer && (
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSetup(setup.id, setup.status) }}
                        className={`text-xs hover:underline ${setup.status === "disabled" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}
                      >
                        {setup.status === "disabled" ? "有効にする" : "使用不可にする"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSetup(setup.id) }}
                        className="text-xs text-[var(--danger)] hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </button>
                )
              })
            )}
          </div>

          {/* Main content: Selected setup detail */}
          <div className={`${!selectedSetup ? "hidden lg:block" : ""}`}>
            {selectedSetup ? (
              <>
              <button
                onClick={() => setSelectedSetup(null)}
                className="lg:hidden text-sm text-[var(--muted)] hover:text-white mb-4"
              >
                ← 台一覧に戻る
              </button>
              <SetupDetail
                setupId={selectedSetup}
                tournamentId={id}
                xId={xId}
                isOrganizer={isOrganizer}
                playSound={playSound}
              />
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-[var(--muted)]">
                ← 台を選択してください
              </div>
            )}
          </div>
        </div>
      </div>
      {error && <div className="fixed bottom-4 left-4 right-4 bg-[var(--danger)] text-white text-sm p-3 rounded-xl text-center">{error}</div>}

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowTemplateEditor(false)}>
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">募集テンプレート編集</h3>
            <p className="text-xs text-[var(--muted)]">1行に1つテンプレートを入力してください</p>
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              rows={10}
              className="w-full bg-[var(--background)] border border-[var(--card-border)] text-white text-sm py-3 px-3 rounded-lg focus:outline-none focus:border-[var(--accent)] resize-y"
            />
            <div className="flex gap-3">
              <button onClick={saveTemplateChanges} disabled={templateLoading} className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
                {templateLoading ? "保存中..." : "保存"}
              </button>
              <button onClick={() => setShowTemplateEditor(false)} className="flex-1 bg-[var(--card)] border border-[var(--card-border)] text-white font-semibold py-3 rounded-lg hover:border-[var(--accent)] transition-colors">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer Settings Modal */}
      {showTimerSettings && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowTimerSettings(false)}>
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">時間設定</h3>
            <div className="space-y-3">
              {([
                { key: "matchDuration", label: "対戦時間", min: 1, max: 120 },
                { key: "recruitmentExpiry", label: "募集期限", min: 1, max: 60 },
                { key: "callingTimeout", label: "呼び出し猶予", min: 1, max: 30 },
                { key: "fiveMinWarning", label: "終了前通知", min: 0, max: 120 },
                { key: "penaltyDuration", label: "ペナルティ", min: 0, max: 60 },
              ] as const).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <label className="text-sm text-[var(--muted)] shrink-0">{item.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={item.min}
                      max={item.max}
                      value={timerSettings[item.key]}
                      onChange={(e) => setTimerSettings(prev => ({ ...prev, [item.key]: Number(e.target.value) }))}
                      className="w-20 bg-[var(--background)] border border-[var(--card-border)] text-white text-sm py-2 px-3 rounded-lg text-center focus:outline-none focus:border-[var(--accent)]"
                    />
                    <span className="text-xs text-[var(--muted)]">分</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveTimerSettings} disabled={timerLoading} className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
                {timerLoading ? "保存中..." : "保存"}
              </button>
              <button onClick={() => setShowTimerSettings(false)} className="flex-1 bg-[var(--card)] border border-[var(--card-border)] text-white font-semibold py-3 rounded-lg hover:border-[var(--accent)] transition-colors">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// === Setup Detail Component ===

function SetupDetail({ setupId, tournamentId, xId, isOrganizer, playSound }: {
  setupId: string; tournamentId: string; xId: string; isOrganizer: boolean; playSound: () => void
}) {
  const [templateOptions, setTemplateOptions] = useState<string[]>([])
  const [template, setTemplate] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  // Realtime hooks
  const { setup: realtimeSetup, currentMatch: realtimeCurrentMatch, queue: realtimeQueue, recruitments: realtimeRecruitments, refetch: refetchDetail } = useSetupDetail(setupId, tournamentId)
  const myStatus = useMyStatus(tournamentId, xId)
  useMatchNotification(realtimeCurrentMatch, xId, playSound)

  const setup = realtimeSetup as (Setup & Record<string, unknown>) | null
  const currentMatch = realtimeCurrentMatch as Match | null
  const queue = realtimeQueue as QueueEntry[]
  const recruitments = realtimeRecruitments as Recruitment[]

  // Fetch templates (one-time, not realtime)
  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/templates`)
      .then(r => r.ok ? r.json() : [])
      .then(setTemplateOptions)
  }, [tournamentId])

  // Trigger timeout check once when opening setup detail
  useEffect(() => {
    fetch(`/api/setups/${setupId}/match`).catch(() => {})
  }, [setupId])

  // Restore title on focus
  useEffect(() => {
    const handler = () => { document.title = "SmashQueue - スマブラ大会フリー対戦管理" }
    window.addEventListener("focus", handler)
    return () => window.removeEventListener("focus", handler)
  }, [])

  // Create recruitment
  async function createRecruitment() {
    setLoading(true)
    await fetch(`/api/setups/${setupId}/recruit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, description }),
    })
    setTemplate("")
    setDescription("")
    refetchDetail()
    setLoading(false)
  }

  // Join recruitment
  async function joinRecruitment(recruitmentId: string) {
    setLoading(true)
    await fetch(`/api/setups/${setupId}/recruit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", recruitmentId }),
    })
    refetchDetail()
    setLoading(false)
  }

  // Cancel recruitment
  async function cancelRecruitment(recruitmentId: string) {
    await fetch(`/api/setups/${setupId}/recruit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", recruitmentId }),
    })
    refetchDetail()
  }

  // Ready
  async function markReady(matchId: string) {
    setLoading(true)
    const res = await fetch(`/api/setups/${setupId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ready", matchId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "エラー" }))
      alert(err.error || "操作に失敗しました")
    }
    refetchDetail()
    setLoading(false)
  }

  // End match
  async function endMatch(matchId: string) {
    setLoading(true)
    const res = await fetch(`/api/setups/${setupId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", matchId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "エラー" }))
      alert(err.error || "操作に失敗しました")
    }
    refetchDetail()
    setLoading(false)
  }

  // Force end (organizer)
  async function forceEnd() {
    setLoading(true)
    const res = await fetch(`/api/setups/${setupId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_end" }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "エラー" }))
      alert(err.error || "操作に失敗しました")
    }
    refetchDetail()
    setLoading(false)
  }

  // Force remove from queue (organizer)
  async function forceRemove(entryId: string) {
    await fetch(`/api/setups/${setupId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_remove", entryId }),
    })
    refetchDetail()
  }

  if (!setup) return <div className="animate-pulse text-[var(--muted)]">読み込み中...</div>

  const match = currentMatch
  const isInMatch = match && (match.player1_id === xId || match.player2_id === xId)
  const isPlayer1 = match?.player1_id === xId
  const myReady = isPlayer1 ? match?.player1_ready : match?.player2_ready
  const isInQueue = queue.some((e) => e.player1_id === xId || e.player2_id === xId)
  const isDisabled = setup.status === "disabled"
  const isBusy = isInMatch || isInQueue || isDisabled || myStatus.hasRecruitment || myStatus.inQueue || myStatus.inMatch || myStatus.hasPenalty

  return (
    <div className="space-y-6">
      {/* Setup header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{setup.name}</h2>
        <span className={`text-sm px-3 py-1 rounded-full ${
          setup.status === "disabled" ? "bg-gray-500/20 text-gray-400" :
          setup.status === "idle" ? "bg-green-500/20 text-green-400" :
          setup.status === "calling" ? "bg-yellow-500/20 text-yellow-400" :
          "bg-red-500/20 text-red-400"
        }`}>
          {setup.status === "disabled" ? "使用不可" : setup.status === "idle" ? "空き" : setup.status === "calling" ? "呼出中" : "使用中"}
        </span>
      </div>

      {/* Disabled notice */}
      {setup.status === "disabled" && (
        <div className="p-5 rounded-xl border border-gray-500/30 bg-gray-500/5 text-center">
          <p className="text-gray-400 font-semibold">この台は現在使用不可です</p>
          <p className="text-xs text-[var(--muted)] mt-1">主催者が有効にするまでお待ちください</p>
        </div>
      )}

      {/* Current match */}
      {match && (
        <div className={`p-5 rounded-xl border ${match.status === "calling" ? "border-yellow-500 bg-yellow-500/5" : "border-[var(--card-border)] bg-[var(--card)]"}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">
              {match.status === "calling" ? "🔔 呼び出し中" : "🎮 対戦中"}
            </p>
            <Timer endsAt={new Date(match.ends_at).getTime()} />
          </div>
          <div className="flex items-center justify-center gap-4 text-lg font-bold">
            <XLink player={matchPlayer1(match)} />
            <span className="text-[var(--muted)]">vs</span>
            <XLink player={matchPlayer2(match)} />
          </div>

          {/* Ready button */}
          {match.status === "calling" && isInMatch && !myReady && (
            <button
              onClick={() => markReady(match.id)}
              disabled={loading}
              className="w-full mt-4 bg-[var(--success)] hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity disabled:opacity-50"
            >
              {loading ? "処理中..." : "🪑 席についた"}
            </button>
          )}
          {match.status === "calling" && isInMatch && myReady && (
            <p className="text-center mt-4 text-[var(--success)] text-sm font-semibold">✓ 準備完了 — 相手を待っています</p>
          )}

          {/* Ready button for non-participants (show status) */}
          {match.status === "calling" && !isInMatch && (
            <div className="mt-4 text-center text-sm text-[var(--muted)]">
              <p>両プレイヤーの着席を待っています...</p>
              <p className="text-xs mt-1">
                {match.player1_name}: {match.player1_ready ? "✅ 準備完了" : "⏳ 待機中"} / {match.player2_name}: {match.player2_ready ? "✅ 準備完了" : "⏳ 待機中"}
              </p>
            </div>
          )}

          {/* End match button */}
          {match.status === "active" && isInMatch && (
            <button
              onClick={() => endMatch(match.id)}
              disabled={loading}
              className="w-full mt-4 bg-[var(--card)] border border-[var(--card-border)] hover:border-[var(--danger)] text-[var(--danger)] font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "処理中..." : "対戦終了"}
            </button>
          )}

          {/* Organizer force end */}
          {isOrganizer && (
            <button
              onClick={forceEnd}
              disabled={loading}
              className="w-full mt-2 text-xs text-[var(--danger)] hover:underline disabled:opacity-50"
            >
              {loading ? "処理中..." : "[主催者] 強制終了"}
            </button>
          )}
        </div>
      )}

      {/* Queue */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--muted)] mb-3">待ち順（{queue.length}組）</h3>
        {queue.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">待機中のペアはいません</p>
        ) : (
          <div className="space-y-2">
            {queue.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[var(--accent)] w-6">{i + 1}</span>
                  <span className="text-sm"><XLink player={queuePlayer1(entry)} /> vs <XLink player={queuePlayer2(entry)} /></span>
                </div>
                {isOrganizer && (
                  <button onClick={() => forceRemove(entry.id)} className="text-xs text-[var(--danger)] hover:underline">削除</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recruitments */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--muted)] mb-3">募集中</h3>
        {recruitments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">募集はありません</p>
        ) : (
          <div className="space-y-2">
            {recruitments.map((r) => {
              const creator = recruitmentCreator(r)
              return (
              <div key={r.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <XLink player={creator} />
                  <RecruitmentTimer expiresAt={r.expires_at ? new Date(r.expires_at).getTime() : 0} />
                </div>
                {r.template && <p className="text-sm text-[var(--accent)] mb-1">{r.template}</p>}
                {r.description && <p className="text-sm text-[var(--muted)]">{r.description}</p>}
                <div className="mt-3 flex gap-2">
                  {creator.id !== xId ? (
                    isBusy ? (
                      <span className="text-xs text-[var(--muted)]">
                        {myStatus.hasPenalty ? "ペナルティ中は参加できません" : myStatus.hasRecruitment ? "募集中は他の募集に参加できません" : "参加できません"}
                      </span>
                    ) : (
                      <button
                        onClick={() => joinRecruitment(r.id)}
                        disabled={loading}
                        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        参加する
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => cancelRecruitment(r.id)}
                      className="text-sm text-[var(--danger)] hover:underline"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create recruitment */}
      {isBusy ? (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5 text-center">
          <p className="text-sm text-[var(--muted)]">
            {isDisabled ? "この台は使用不可です" : myStatus.hasPenalty ? <PenaltyMessage until={myStatus.penaltyUntil} /> : (isInMatch || myStatus.inMatch) ? "対戦中は新しい募集を作成できません" : myStatus.hasRecruitment ? `「${myStatus.recruitmentSetupName}」で募集中です。キャンセルしてから再度お試しください` : (isInQueue || myStatus.inQueue) ? "キューで待機中は新しい募集を作成できません" : "募集できません"}
          </p>
        </div>
      ) : (
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">対戦を募集する</h3>
        <div className="space-y-3">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full bg-[var(--background)] border border-[var(--card-border)] text-white text-sm py-2.5 px-3 rounded-lg focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">テンプレートを選択（任意）</option>
            {templateOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="自由記述（例: キャラ限定など）"
            className="w-full bg-[var(--background)] border border-[var(--card-border)] text-white text-sm py-2.5 px-3 rounded-lg focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
          />
          <button
            onClick={createRecruitment}
            disabled={loading}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            募集する
          </button>
        </div>
      </div>
      )}
    </div>
  )
}

// === Helper Components ===

function PenaltyMessage({ until }: { until: string | null }) {
  const [remaining, setRemaining] = useState("")
  useEffect(() => {
    if (!until) return
    const update = () => {
      const diff = Math.max(0, new Date(until).getTime() - Date.now())
      const min = Math.floor(diff / 60000)
      const sec = Math.floor((diff % 60000) / 1000)
      setRemaining(`${min}:${sec.toString().padStart(2, "0")}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [until])
  return (
    <span className="text-[var(--danger)]">
      ⚠️ ペナルティ中です（残り {remaining}）<br />
      <span className="text-xs">呼び出しに応答しなかったため、一時的に募集・参加ができません</span>
    </span>
  )
}

function XLink({ player }: { player: Player }) {
  if (player.xUsername) {
    return (
      <a
        href={`https://x.com/${player.xUsername}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent)] hover:underline"
      >
        {player.name}{player.xUsername !== player.name ? ` (@${player.xUsername})` : ""}
      </a>
    )
  }
  return <span className="text-foreground font-semibold">{player.name}</span>
}

function Timer({ endsAt }: { endsAt: number }) {
  const [remaining, setRemaining] = useState("")
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, endsAt - Date.now())
      const min = Math.floor(diff / 60000)
      const sec = Math.floor((diff % 60000) / 1000)
      setRemaining(`${min}:${sec.toString().padStart(2, "0")}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [endsAt])
  return <span className="font-mono text-sm text-[var(--warning)]">{remaining}</span>
}

function RecruitmentTimer({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState("")
  useEffect(() => {
    if (expiresAt === 0) {
      setRemaining("待機中")
      return
    }
    const update = () => {
      const diff = Math.max(0, expiresAt - Date.now())
      const min = Math.floor(diff / 60000)
      const sec = Math.floor((diff % 60000) / 1000)
      setRemaining(`残り ${min}:${sec.toString().padStart(2, "0")}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])
  return <span className="text-xs text-[var(--muted)]">{remaining}</span>
}
