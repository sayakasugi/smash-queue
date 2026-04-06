"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "../../providers"

type Tournament = { id: string; name: string; code: string; organizerId: string }
type Player = { id: string; name: string; xUsername: string }
type Setup = { id: string; name: string; status: string; currentMatch: Match | null; tournamentId: string }
type Match = { id: string; setupId: string; player1: Player; player2: Player; startedAt: number; endsAt: number; status: string; player1Ready: boolean; player2Ready: boolean }
type QueueEntry = { id: string; player1: Player; player2: Player; position: number; status: string }
type Recruitment = { id: string; setupId: string; creator: Player; template: string; description: string; expiresAt: number; status: string }

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [setups, setSetups] = useState<Setup[]>([])
  const [setupRecruitCounts, setSetupRecruitCounts] = useState<Record<string, number>>({})
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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const xId = user?.id || ""
  const isOrganizer = tournament?.organizerId === xId

  // Fetch tournament
  useEffect(() => {
    fetch(`/api/tournaments/${id}`)
      .then(r => { if (r.ok) return r.json(); return null })
      .then(data => { if (data) setTournament(data) })
  }, [id])

  // Fetch setups (poll every 3 seconds)
  const fetchSetups = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${id}/setups`)
    if (res.ok) {
      const data = await res.json()
      setSetups(data)
      // Fetch recruit counts for each setup
      const counts: Record<string, number> = {}
      await Promise.all(data.map(async (s: Setup) => {
        const r = await fetch(`/api/setups/${s.id}/recruit`)
        if (r.ok) {
          const recruits = await r.json()
          counts[s.id] = recruits.length
        }
      }))
      setSetupRecruitCounts(counts)
    }
  }, [id])

  useEffect(() => {
    fetchSetups()
    const interval = setInterval(fetchSetups, 3000)
    return () => clearInterval(interval)
  }, [fetchSetups])

  // Add setup (single)
  async function addSetup() {
    if (!newSetupName.trim()) return
    await fetch(`/api/tournaments/${id}/setups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSetupName.trim() }),
    })
    setNewSetupName("")
    fetchSetups()
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
    fetchSetups()
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
    fetchSetups()
  }

  // Toggle setup disabled
  async function toggleSetup(setupId: string, currentStatus: string) {
    await fetch(`/api/tournaments/${id}/setups`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupId, disabled: currentStatus !== "disabled" }),
    })
    fetchSetups()
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
    fetchSetups()
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
              <button onClick={openTemplateEditor} className="text-xs text-[var(--accent)] hover:underline">テンプレート編集</button>
            )}
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
              setups.map((setup) => (
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
                  {setup.currentMatch && (
                    <p className="text-xs text-[var(--muted)] mt-2">
                      {setup.currentMatch.player1.name} vs {setup.currentMatch.player2.name}
                    </p>
                  )}
                  {(setupRecruitCounts[setup.id] || 0) > 0 && (
                    <p className="text-xs text-[var(--accent)] mt-1">📢 募集中: {setupRecruitCounts[setup.id]}件</p>
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
              ))
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
    </div>
  )
}

// === Setup Detail Component ===

function SetupDetail({ setupId, tournamentId, xId, isOrganizer, playSound }: {
  setupId: string; tournamentId: string; xId: string; isOrganizer: boolean; playSound: () => void
}) {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [recruitments, setRecruitments] = useState<Recruitment[]>([])
  const [templateOptions, setTemplateOptions] = useState<string[]>([])
  const [template, setTemplate] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [myStatus, setMyStatus] = useState<{ hasRecruitment: boolean; inQueue: boolean; inMatch: boolean; recruitmentSetupName: string }>({ hasRecruitment: false, inQueue: false, inMatch: false, recruitmentSetupName: "" })
  const prevStatusRef = useRef<string>("")

  // Fetch templates
  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/templates`)
      .then(r => r.ok ? r.json() : [])
      .then(setTemplateOptions)
  }, [tournamentId])

  // Poll setup state
  const fetchState = useCallback(async () => {
    const [matchRes, recruitRes, statusRes] = await Promise.all([
      fetch(`/api/setups/${setupId}/match`),
      fetch(`/api/setups/${setupId}/recruit`),
      fetch(`/api/tournaments/${tournamentId}/my-status`),
    ])
    if (statusRes.ok) setMyStatus(await statusRes.json())
    if (matchRes.ok) {
      const data = await matchRes.json()
      // Notify if calling and involves this player
      if (data.setup?.currentMatch?.status === "calling" && prevStatusRef.current !== "calling") {
        const m = data.setup.currentMatch
        if (m.player1.id === xId || m.player2.id === xId) {
          playSound()
          if (document.hidden) document.title = "🔔 順番が来ました！ - SmashQueue"
        }
      }
      prevStatusRef.current = data.setup?.currentMatch?.status || ""
      setSetup(data.setup)
      setQueue(data.queue)
    }
    if (recruitRes.ok) setRecruitments(await recruitRes.json())
  }, [setupId, xId, playSound])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 3000)
    return () => clearInterval(interval)
  }, [fetchState])

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
    await fetchState()
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
    await fetchState()
    setLoading(false)
  }

  // Cancel recruitment
  async function cancelRecruitment(recruitmentId: string) {
    await fetch(`/api/setups/${setupId}/recruit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", recruitmentId }),
    })
    await fetchState()
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
    await fetchState()
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
    await fetchState()
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
    await fetchState()
    setLoading(false)
  }

  // Force remove from queue (organizer)
  async function forceRemove(entryId: string) {
    await fetch(`/api/setups/${setupId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_remove", entryId }),
    })
    await fetchState()
  }

  if (!setup) return <div className="animate-pulse text-[var(--muted)]">読み込み中...</div>

  const match = setup.currentMatch
  const isInMatch = match && (match.player1.id === xId || match.player2.id === xId)
  const isPlayer1 = match?.player1.id === xId
  const myReady = isPlayer1 ? match?.player1Ready : match?.player2Ready
  const isInQueue = queue.some((e) => e.player1.id === xId || e.player2.id === xId)
  const isDisabled = setup.status === "disabled"
  const isBusy = isInMatch || isInQueue || isDisabled || myStatus.hasRecruitment || myStatus.inQueue || myStatus.inMatch

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
            <Timer endsAt={match.endsAt} />
          </div>
          <div className="flex items-center justify-center gap-4 text-lg font-bold">
            <XLink player={match.player1} />
            <span className="text-[var(--muted)]">vs</span>
            <XLink player={match.player2} />
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
                {match.player1.name}: {match.player1Ready ? "✅ 準備完了" : "⏳ 待機中"} / {match.player2.name}: {match.player2Ready ? "✅ 準備完了" : "⏳ 待機中"}
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
                  <span className="text-sm"><XLink player={entry.player1} /> vs <XLink player={entry.player2} /></span>
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
            {recruitments.map((r) => (
              <div key={r.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <XLink player={r.creator} />
                  <RecruitmentTimer expiresAt={r.expiresAt} />
                </div>
                {r.template && <p className="text-sm text-[var(--accent)] mb-1">{r.template}</p>}
                {r.description && <p className="text-sm text-[var(--muted)]">{r.description}</p>}
                <div className="mt-3 flex gap-2">
                  {r.creator.id !== xId ? (
                    <button
                      onClick={() => joinRecruitment(r.id)}
                      disabled={loading}
                      className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      参加する
                    </button>
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
            ))}
          </div>
        )}
      </div>

      {/* Create recruitment */}
      {isBusy ? (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5 text-center">
          <p className="text-sm text-[var(--muted)]">
            {isDisabled ? "この台は使用不可です" : (isInMatch || myStatus.inMatch) ? "対戦中は新しい募集を作成できません" : myStatus.hasRecruitment ? `「${myStatus.recruitmentSetupName}」で募集中です。キャンセルしてから再度お試しください` : (isInQueue || myStatus.inQueue) ? "キューで待機中は新しい募集を作成できません" : "募集できません"}
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

function XLink({ player }: { player: Player }) {
  return (
    <a
      href={`https://x.com/${player.xUsername}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent)] hover:underline"
    >
      {player.name || `@${player.xUsername}`}
    </a>
  )
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
