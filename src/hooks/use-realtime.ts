"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabaseClient } from '@/lib/supabase-client'

// === Setup list with realtime ===

export function useSetups(tournamentId: string) {
  const [setups, setSetups] = useState<Record<string, unknown>[]>([])
  const [recruitCounts, setRecruitCounts] = useState<Record<string, number>>({})

  const fetchAll = useCallback(async () => {
    const [setupsRes, recruitmentsRes] = await Promise.all([
      supabaseClient.from('setups').select().eq('tournament_id', tournamentId),
      supabaseClient.from('recruitments').select('setup_id').eq('tournament_id', tournamentId).eq('status', 'open'),
    ])
    const data = (setupsRes.data || []).sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }))
    setSetups(data)

    const counts: Record<string, number> = {}
    for (const r of recruitmentsRes.data || []) counts[r.setup_id] = (counts[r.setup_id] || 0) + 1
    setRecruitCounts(counts)
  }, [tournamentId])

  useEffect(() => {
    fetchAll()

    const channel = supabaseClient
      .channel(`setups-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'setups', filter: `tournament_id=eq.${tournamentId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recruitments', filter: `tournament_id=eq.${tournamentId}` }, () => fetchAll())
      .subscribe()

    return () => { supabaseClient.removeChannel(channel) }
  }, [tournamentId, fetchAll])

  return { setups, recruitCounts, refetch: fetchAll }
}

// === Setup detail: match + queue + recruitments ===

export function useSetupDetail(setupId: string | null, tournamentId: string) {
  const [setup, setSetup] = useState<Record<string, unknown> | null>(null)
  const [currentMatch, setCurrentMatch] = useState<Record<string, unknown> | null>(null)
  const [queue, setQueue] = useState<Record<string, unknown>[]>([])
  const [recruitments, setRecruitments] = useState<Record<string, unknown>[]>([])

  const fetchAll = useCallback(async () => {
    if (!setupId) return

    const [setupRes, queueRes, recruitRes] = await Promise.all([
      supabaseClient.from('setups').select().eq('id', setupId).single(),
      supabaseClient.from('queue_entries').select().eq('setup_id', setupId).in('status', ['waiting', 'calling']).order('position'),
      supabaseClient.from('recruitments').select().eq('setup_id', setupId).eq('status', 'open').order('created_at', { ascending: true }),
    ])

    if (setupRes.data) {
      setSetup(setupRes.data)
      if (setupRes.data.current_match_id) {
        const { data: match } = await supabaseClient.from('matches').select().eq('id', setupRes.data.current_match_id).single()
        setCurrentMatch(match)
      } else {
        setCurrentMatch(null)
      }
    }
    setQueue(queueRes.data || [])
    setRecruitments(recruitRes.data || [])
  }, [setupId])

  useEffect(() => {
    if (!setupId) return
    fetchAll()

    const channel = supabaseClient
      .channel(`setup-detail-${setupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'setups', filter: `id=eq.${setupId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        const row = payload.new as Record<string, unknown>
        if (row && row.setup_id === setupId) fetchAll()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `setup_id=eq.${setupId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recruitments', filter: `setup_id=eq.${setupId}` }, () => fetchAll())
      .subscribe()

    return () => { supabaseClient.removeChannel(channel) }
  }, [setupId, fetchAll])

  return { setup, currentMatch, queue, recruitments, refetch: fetchAll }
}

// === My status across tournament ===

export function useMyStatus(tournamentId: string, userId: string | undefined) {
  const [status, setStatus] = useState({ hasRecruitment: false, inQueue: false, inMatch: false, recruitmentSetupName: "", hasPenalty: false, penaltyUntil: null as string | null })

  const fetchStatus = useCallback(async () => {
    if (!userId) return
    const res = await fetch(`/api/tournaments/${tournamentId}/my-status`)
    if (res.ok) setStatus(await res.json())
  }, [tournamentId, userId])

  useEffect(() => {
    fetchStatus()

    const channel = supabaseClient
      .channel(`my-status-${tournamentId}-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recruitments', filter: `tournament_id=eq.${tournamentId}` }, () => fetchStatus())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `tournament_id=eq.${tournamentId}` }, () => fetchStatus())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, () => fetchStatus())
      .subscribe()

    return () => { supabaseClient.removeChannel(channel) }
  }, [tournamentId, userId, fetchStatus])

  return status
}

// === Notification hook: play sound when match calls me ===

export function useMatchNotification(currentMatch: Record<string, unknown> | null, userId: string | undefined, playSound: () => void) {
  const prevStatusRef = useRef<string>("")

  useEffect(() => {
    if (!currentMatch || !userId) return

    const status = currentMatch.status as string
    const p1 = currentMatch.player1_id as string
    const p2 = currentMatch.player2_id as string
    const isMe = p1 === userId || p2 === userId

    // Calling notification
    if (status === "calling" && prevStatusRef.current !== "calling" && isMe) {
      playSound()
      if (document.hidden) document.title = "🔔 順番が来ました！ - SmashQueue"
    }

    prevStatusRef.current = status
  }, [currentMatch, userId, playSound])
}
