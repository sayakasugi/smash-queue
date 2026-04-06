import { supabase } from './supabase'
import type { TimerSettings } from './types'
import { getTimerMs, DEFAULT_TIMER_SETTINGS } from './types'

// === Types (DB row shapes) ===

export type Player = { id: string; name: string; xUsername: string }
export type Setup = { id: string; tournament_id: string; name: string; status: string; current_match_id: string | null }
export type Match = { id: string; setup_id: string; tournament_id: string; player1_id: string; player1_name: string; player1_x: string; player2_id: string; player2_name: string; player2_x: string; player1_ready: boolean; player2_ready: boolean; status: string; started_at: string; ends_at: string }
export type QueueEntry = { id: string; setup_id: string; tournament_id: string; player1_id: string; player1_name: string; player1_x: string; player2_id: string; player2_name: string; player2_x: string; position: number; status: string; recruitment_id: string | null }
export type Recruitment = { id: string; setup_id: string; tournament_id: string; creator_id: string; creator_name: string; creator_x: string; template: string; description: string; status: string; expires_at: string | null; created_at: string }
export type Tournament = { id: string; name: string; code: string; organizer_id: string; organizer_name: string; status: string; match_duration: number; recruitment_expiry: number; calling_timeout: number; five_min_warning: number; penalty_duration: number; created_at: string }

// === Helpers ===

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function getTimer(t?: Tournament | null) {
  if (!t) return getTimerMs()
  return getTimerMs({ matchDuration: t.match_duration, recruitmentExpiry: t.recruitment_expiry, callingTimeout: t.calling_timeout, fiveMinWarning: t.five_min_warning, penaltyDuration: t.penalty_duration })
}

// === Tournament ===

export async function createTournament(name: string, organizer: Player) {
  // Ensure user exists in users table
  const { data: existingUser } = await supabase.from('users').select('id').eq('id', organizer.id).single()
  if (!existingUser) {
    await supabase.from('users').insert({
      id: organizer.id, x_username: organizer.xUsername, name: organizer.name, password_hash: '',
    })
  }

  const id = generateId()
  const code = generateCode()
  const { data, error } = await supabase.from('tournaments').insert({
    id, name, code, organizer_id: organizer.id, organizer_name: organizer.name, status: 'active',
  }).select().single()
  if (error) throw error

  await supabase.from('tournament_participants').insert({ tournament_id: id, user_id: organizer.id })
  return data
}

export async function getTournament(id: string) {
  const { data } = await supabase.from('tournaments').select().eq('id', id).single()
  return data as Tournament | null
}

export async function getTournamentByCode(code: string) {
  const { data } = await supabase.from('tournaments').select().eq('code', code).single()
  return data as Tournament | null
}

export async function joinTournament(code: string, player: Player) {
  const tournament = await getTournamentByCode(code)
  if (!tournament || tournament.status !== 'active') return null

  // Ensure user exists
  const { data: existingUser } = await supabase.from('users').select('id').eq('id', player.id).single()
  if (!existingUser) {
    await supabase.from('users').insert({
      id: player.id, x_username: player.xUsername, name: player.name, password_hash: '',
    })
  }

  await supabase.from('tournament_participants').upsert({ tournament_id: tournament.id, user_id: player.id })
  return tournament
}

export async function getPlayerTournaments(playerId: string) {
  const { data } = await supabase.from('tournament_participants').select('tournament_id').eq('user_id', playerId)
  if (!data || data.length === 0) return []
  const ids = data.map(d => d.tournament_id)
  const { data: tournaments } = await supabase.from('tournaments').select().in('id', ids).order('created_at', { ascending: false })
  return tournaments || []
}

// === Setup ===

export async function createSetup(tournamentId: string, name: string) {
  const id = generateId()
  const { data, error } = await supabase.from('setups').insert({ id, tournament_id: tournamentId, name, status: 'idle' }).select().single()
  if (error) throw error
  return data
}

export async function getSetup(id: string) {
  const { data } = await supabase.from('setups').select().eq('id', id).single()
  return data as Setup | null
}

export async function getSetups(tournamentId: string) {
  const { data } = await supabase.from('setups').select().eq('tournament_id', tournamentId)
  const setups = (data || []) as Setup[]
  return setups.sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }))
}

export async function updateSetup(id: string, updates: Partial<Setup>) {
  await supabase.from('setups').update(updates).eq('id', id)
}

export async function deleteSetup(id: string) {
  // Delete related data first to avoid FK issues
  await supabase.from('queue_entries').delete().eq('setup_id', id)
  await supabase.from('recruitments').delete().eq('setup_id', id)
  await supabase.from('matches').delete().eq('setup_id', id)
  await supabase.from('setups').delete().eq('id', id)
}

// === Recruitment ===

export async function createRecruitment(setupId: string, tournamentId: string, creator: Player, template: string, description: string) {
  // Check active recruitment
  const { data: existing } = await supabase.from('recruitments').select().eq('creator_id', creator.id).eq('tournament_id', tournamentId).eq('status', 'open')
  if (existing && existing.length > 0) return null

  // Check penalty
  const penalty = await getPlayerPenalty(creator.id, tournamentId)
  if (penalty) return null

  const id = generateId()
  const { data, error } = await supabase.from('recruitments').insert({
    id, setup_id: setupId, tournament_id: tournamentId, creator_id: creator.id, creator_name: creator.name, creator_x: creator.xUsername,
    template, description, status: 'open', expires_at: null, // set when becomes first
  }).select().single()
  if (error) throw error
  return data
}

export async function getSetupRecruitments(setupId: string) {
  const { data } = await supabase.from('recruitments').select().eq('setup_id', setupId).eq('status', 'open').order('created_at', { ascending: true })
  if (!data || data.length === 0) return []

  const now = new Date()
  const result: Recruitment[] = []

  // Get tournament for timer settings
  const setup = await getSetup(setupId)
  const tournament = setup ? await getTournament(setup.tournament_id) : null
  const timer = getTimer(tournament)

  for (let i = 0; i < data.length; i++) {
    const r = data[i] as Recruitment

    if (i === 0) {
      // First: activate timer if not set
      if (!r.expires_at) {
        const expiresAt = new Date(now.getTime() + timer.recruitmentExpiry).toISOString()
        await supabase.from('recruitments').update({ expires_at: expiresAt }).eq('id', r.id)
        r.expires_at = expiresAt
      }
      // Check expiry
      if (new Date(r.expires_at) <= now) {
        await supabase.from('recruitments').update({ status: 'expired' }).eq('id', r.id)
        continue
      }
    }
    result.push(r)
  }

  // If first was expired, activate next
  if (result.length > 0 && !result[0].expires_at) {
    const expiresAt = new Date(now.getTime() + timer.recruitmentExpiry).toISOString()
    await supabase.from('recruitments').update({ expires_at: expiresAt }).eq('id', result[0].id)
    result[0].expires_at = expiresAt
  }

  return result
}

export async function joinRecruitment(recruitmentId: string, player: Player) {
  const { data: r } = await supabase.from('recruitments').select().eq('id', recruitmentId).single()
  if (!r || r.status !== 'open' || r.creator_id === player.id) return null

  const penalty = await getPlayerPenalty(player.id, r.tournament_id)
  if (penalty) return null

  await supabase.from('recruitments').update({ status: 'matched' }).eq('id', recruitmentId)

  // Add to queue
  const entry = await addToQueue(r.setup_id, r.tournament_id, { id: r.creator_id, name: r.creator_name, xUsername: r.creator_x }, player, recruitmentId)
  return entry
}

export async function cancelRecruitment(recruitmentId: string, playerId: string) {
  const { data: r } = await supabase.from('recruitments').select().eq('id', recruitmentId).single()
  if (!r || r.status !== 'open' || r.creator_id !== playerId) return false
  await supabase.from('recruitments').update({ status: 'cancelled' }).eq('id', recruitmentId)
  return true
}

// === Queue ===

async function addToQueue(setupId: string, tournamentId: string, player1: Player, player2: Player, recruitmentId: string) {
  const { count } = await supabase.from('queue_entries').select('*', { count: 'exact', head: true }).eq('setup_id', setupId).in('status', ['waiting', 'calling'])
  const id = generateId()
  const { data, error } = await supabase.from('queue_entries').insert({
    id, setup_id: setupId, tournament_id: tournamentId,
    player1_id: player1.id, player1_name: player1.name, player1_x: player1.xUsername,
    player2_id: player2.id, player2_name: player2.name, player2_x: player2.xUsername,
    recruitment_id: recruitmentId, position: count || 0, status: 'waiting',
  }).select().single()
  if (error) throw error

  // If setup is idle, start next match
  const setup = await getSetup(setupId)
  if (setup && setup.status === 'idle') {
    await startNextMatch(setupId)
  }

  return data
}

export async function getQueue(setupId: string) {
  const { data } = await supabase.from('queue_entries').select().eq('setup_id', setupId).in('status', ['waiting', 'calling']).order('position')
  return data || []
}

// === Match ===

export async function startNextMatch(setupId: string) {
  const { data: entries } = await supabase.from('queue_entries').select().eq('setup_id', setupId).eq('status', 'waiting').order('position').limit(1)
  if (!entries || entries.length === 0) return null

  const entry = entries[0]
  const setup = await getSetup(setupId)
  const tournament = setup ? await getTournament(setup.tournament_id) : null
  const timer = getTimer(tournament)

  const id = generateId()
  const now = new Date()
  const endsAt = new Date(now.getTime() + timer.callingTimeout).toISOString()

  await supabase.from('matches').insert({
    id, setup_id: setupId, tournament_id: entry.tournament_id,
    player1_id: entry.player1_id, player1_name: entry.player1_name, player1_x: entry.player1_x,
    player2_id: entry.player2_id, player2_name: entry.player2_name, player2_x: entry.player2_x,
    status: 'calling', ends_at: endsAt,
  })

  await supabase.from('setups').update({ status: 'calling', current_match_id: id }).eq('id', setupId)
  await supabase.from('queue_entries').update({ status: 'calling' }).eq('id', entry.id)

  return id
}

export async function getMatch(id: string) {
  const { data } = await supabase.from('matches').select().eq('id', id).single()
  return data as Match | null
}

export async function playerReady(matchId: string, playerId: string) {
  const match = await getMatch(matchId)
  if (!match) return null

  const updates: Partial<Match> = {}
  if (match.player1_id === playerId) updates.player1_ready = true
  if (match.player2_id === playerId) updates.player2_ready = true

  const p1Ready = match.player1_id === playerId ? true : match.player1_ready
  const p2Ready = match.player2_id === playerId ? true : match.player2_ready

  if (p1Ready && p2Ready) {
    const setup = await getSetup(match.setup_id)
    const tournament = setup ? await getTournament(setup.tournament_id) : null
    const timer = getTimer(tournament)
    const now = new Date()

    updates.status = 'active'
    updates.started_at = now.toISOString()
    updates.ends_at = new Date(now.getTime() + timer.matchDuration).toISOString()

    await supabase.from('setups').update({ status: 'in_use' }).eq('id', match.setup_id)
  }

  await supabase.from('matches').update(updates).eq('id', matchId)
  return { ...match, ...updates }
}

export async function endMatch(matchId: string) {
  const match = await getMatch(matchId)
  if (!match) return

  await supabase.from('matches').update({ status: 'finished' }).eq('id', matchId)
  await supabase.from('setups').update({ status: 'idle', current_match_id: null }).eq('id', match.setup_id)
  await startNextMatch(match.setup_id)
}

// === Timeout checks ===

export async function checkCallingTimeout(setupId: string): Promise<{ timedOut: boolean; penalized: string[] }> {
  const setup = await getSetup(setupId)
  if (!setup || !setup.current_match_id || setup.status !== 'calling') return { timedOut: false, penalized: [] }

  const match = await getMatch(setup.current_match_id)
  if (!match || match.status !== 'calling') return { timedOut: false, penalized: [] }

  if (new Date(match.ends_at) > new Date()) return { timedOut: false, penalized: [] }

  const penalized: string[] = []
  if (!match.player1_ready) {
    await addPenalty(match.player1_id, match.tournament_id)
    penalized.push(match.player1_name)
  }
  if (!match.player2_ready) {
    await addPenalty(match.player2_id, match.tournament_id)
    penalized.push(match.player2_name)
  }

  await supabase.from('matches').update({ status: 'finished' }).eq('id', match.id)
  await supabase.from('setups').update({ status: 'idle', current_match_id: null }).eq('id', setupId)
  await startNextMatch(setupId)

  return { timedOut: true, penalized }
}

export async function checkMatchTimeout(setupId: string): Promise<{ expired: boolean; fiveMinWarning: boolean }> {
  const setup = await getSetup(setupId)
  if (!setup || !setup.current_match_id || setup.status !== 'in_use') return { expired: false, fiveMinWarning: false }

  const match = await getMatch(setup.current_match_id)
  if (!match || match.status !== 'active') return { expired: false, fiveMinWarning: false }

  const now = new Date()
  const remaining = new Date(match.ends_at).getTime() - now.getTime()

  if (remaining <= 0) {
    await endMatch(match.id)
    return { expired: true, fiveMinWarning: false }
  }

  const tournament = await getTournament(match.tournament_id)
  const timer = getTimer(tournament)
  if (remaining <= timer.fiveMinWarning && remaining > timer.fiveMinWarning - 3000) {
    return { expired: false, fiveMinWarning: true }
  }

  return { expired: false, fiveMinWarning: false }
}

// === Force operations ===

export async function forceEndMatch(setupId: string) {
  const setup = await getSetup(setupId)
  if (!setup || !setup.current_match_id) return
  await endMatch(setup.current_match_id)
}

export async function forceRemoveFromQueue(setupId: string, entryId: string) {
  await supabase.from('queue_entries').delete().eq('id', entryId)
}

// === Penalty ===

export async function addPenalty(playerId: string, tournamentId: string) {
  const tournament = await getTournament(tournamentId)
  const timer = getTimer(tournament)
  const untilAt = new Date(Date.now() + timer.penaltyDuration).toISOString()
  await supabase.from('penalties').insert({ player_id: playerId, tournament_id: tournamentId, until_at: untilAt, reason: 'no_show' })
}

export async function getPlayerPenalty(playerId: string, tournamentId: string) {
  const { data } = await supabase.from('penalties').select().eq('player_id', playerId).eq('tournament_id', tournamentId).gt('until_at', new Date().toISOString()).order('until_at', { ascending: false }).limit(1)
  return data && data.length > 0 ? data[0] : null
}

// === Templates ===

export async function getTemplates(tournamentId: string) {
  const { data } = await supabase.from('templates').select().eq('tournament_id', tournamentId).single()
  if (data) return data.templates as string[]
  return ['レート1500前後', 'レート1600前後', 'レート1700前後', 'レート1800以上', 'おま3', 'おま5', '誰でもOK']
}

export async function saveTemplates(tournamentId: string, templates: string[]) {
  await supabase.from('templates').upsert({ tournament_id: tournamentId, templates })
}

// === Timer settings ===

export async function saveTimerSettings(tournamentId: string, settings: TimerSettings) {
  await supabase.from('tournaments').update({
    match_duration: settings.matchDuration,
    recruitment_expiry: settings.recruitmentExpiry,
    calling_timeout: settings.callingTimeout,
    five_min_warning: settings.fiveMinWarning,
    penalty_duration: settings.penaltyDuration,
  }).eq('id', tournamentId)
}
