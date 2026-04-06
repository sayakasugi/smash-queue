import { redis } from './redis'
import type { Tournament, Setup, Recruitment, QueueEntry, Match, Player, Penalty, TimerSettings } from './types'
import { getTimerMs, DEFAULT_TIMER_SETTINGS } from './types'

// === Helper: parse Redis data (handles both string and object) ===

function parse<T>(data: unknown): T | null {
  if (!data) return null
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return null }
  }
  return data as T
}

// === Timer helper ===

async function getTimerForSetup(setupId: string) {
  const setup = await getSetup(setupId)
  if (!setup) return getTimerMs()
  const tournament = await getTournament(setup.tournamentId)
  return getTimerMs(tournament?.timerSettings)
}

async function getTimerForTournament(tournamentId: string) {
  const tournament = await getTournament(tournamentId)
  return getTimerMs(tournament?.timerSettings)
}

// === ID Generation ===

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// === Tournament CRUD ===

export async function createTournament(name: string, organizer: Player): Promise<Tournament> {
  const id = generateId()
  const code = generateCode()
  const tournament: Tournament = {
    id,
    name,
    code,
    organizerId: organizer.id,
    organizerName: organizer.name,
    createdAt: Date.now(),
    status: 'active',
  }
  await redis.set(`tournament:${id}`, JSON.stringify(tournament))
  await redis.set(`tournament:code:${code}`, id)
  // Add to organizer's tournaments
  await redis.sadd(`player:${organizer.id}:tournaments`, id)
  return tournament
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const data = await redis.get(`tournament:${id}`)
  return parse<Tournament>(data)
}

export async function getTournamentByCode(code: string): Promise<Tournament | null> {
  const id = await redis.get<string>(`tournament:code:${code}`)
  if (!id) return null
  return getTournament(id)
}

export async function joinTournament(code: string, player: Player): Promise<Tournament | null> {
  const tournament = await getTournamentByCode(code)
  if (!tournament || tournament.status !== 'active') return null
  await redis.sadd(`tournament:${tournament.id}:participants`, player.id)
  await redis.set(`player:${player.id}`, JSON.stringify(player))
  await redis.sadd(`player:${player.id}:tournaments`, tournament.id)
  return tournament
}

// === Setup CRUD ===

export async function createSetup(tournamentId: string, name: string): Promise<Setup> {
  const id = generateId()
  const setup: Setup = {
    id,
    tournamentId,
    name,
    status: 'idle',
    currentMatch: null,
    queue: [],
  }
  await redis.set(`setup:${id}`, JSON.stringify(setup))
  await redis.sadd(`tournament:${tournamentId}:setups`, id)
  return setup
}

export async function getSetup(id: string): Promise<Setup | null> {
  const data = await redis.get(`setup:${id}`)
  return parse<Setup>(data)
}

export async function getSetups(tournamentId: string): Promise<Setup[]> {
  const ids = await redis.smembers(`tournament:${tournamentId}:setups`)
  const setups: Setup[] = []
  for (const id of ids) {
    const setup = await getSetup(id)
    if (setup) setups.push(setup)
  }
  // Sort by name (natural sort for numbers)
  return setups.sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }))
}

export async function updateSetup(setup: Setup): Promise<void> {
  await redis.set(`setup:${setup.id}`, JSON.stringify(setup))
}

export async function deleteSetup(id: string, tournamentId: string): Promise<void> {
  await redis.del(`setup:${id}`)
  await redis.srem(`tournament:${tournamentId}:setups`, id)
}

// === Recruitment ===

export async function createRecruitment(
  setupId: string,
  tournamentId: string,
  creator: Player,
  template: string,
  description: string,
): Promise<Recruitment | null> {
  // Check if player already has an active recruitment
  const existing = await getPlayerActiveRecruitment(creator.id, tournamentId)
  if (existing) return null

  // Check penalty
  const penalty = await getPlayerPenalty(creator.id, tournamentId)
  if (penalty) return null

  const id = generateId()
  const now = Date.now()
  const recruitment: Recruitment = {
    id,
    setupId,
    tournamentId,
    creator,
    description,
    template,
    createdAt: now,
    expiresAt: 0, // Set when this becomes the first recruitment
    status: 'open',
    joinedBy: null,
  }
  await redis.set(`recruitment:${id}`, JSON.stringify(recruitment))
  await redis.sadd(`setup:${setupId}:recruitments`, id)
  await redis.set(`player:${creator.id}:active_recruitment:${tournamentId}`, id)
  return recruitment
}

export async function getRecruitment(id: string): Promise<Recruitment | null> {
  const data = await redis.get(`recruitment:${id}`)
  return parse<Recruitment>(data)
}

export async function getSetupRecruitments(setupId: string): Promise<Recruitment[]> {
  const timer = await getTimerForSetup(setupId)
  const ids = await redis.smembers(`setup:${setupId}:recruitments`)
  const recruitments: Recruitment[] = []
  for (const id of ids) {
    const r = await getRecruitment(id)
    if (!r || r.status !== 'open') continue
    recruitments.push(r)
  }

  // Sort by creation time
  recruitments.sort((a, b) => a.createdAt - b.createdAt)

  const now = Date.now()
  const result: Recruitment[] = []

  for (let i = 0; i < recruitments.length; i++) {
    const r = recruitments[i]

    if (i === 0) {
      // First recruitment: activate timer if not set
      if (r.expiresAt === 0) {
        r.expiresAt = now + timer.recruitmentExpiry
        await redis.set(`recruitment:${r.id}`, JSON.stringify(r))
      }
      // Check expiry
      if (r.expiresAt <= now) {
        r.status = 'expired'
        await redis.set(`recruitment:${r.id}`, JSON.stringify(r))
        await redis.srem(`setup:${setupId}:recruitments`, r.id)
        await redis.del(`player:${r.creator.id}:active_recruitment:${r.tournamentId}`)
        continue
      }
    }

    result.push(r)
  }

  // After removing expired first, re-check if new first needs timer
  if (result.length > 0 && result[0].expiresAt === 0) {
    result[0].expiresAt = now + timer.recruitmentExpiry
    await redis.set(`recruitment:${result[0].id}`, JSON.stringify(result[0]))
  }

  return result
}

export async function joinRecruitment(recruitmentId: string, player: Player): Promise<QueueEntry | null> {
  const recruitment = await getRecruitment(recruitmentId)
  if (!recruitment || recruitment.status !== 'open') return null
  if (recruitment.creator.id === player.id) return null

  // Check penalty
  const penalty = await getPlayerPenalty(player.id, recruitment.tournamentId)
  if (penalty) return null

  // Update recruitment
  recruitment.status = 'matched'
  recruitment.joinedBy = player
  await redis.set(`recruitment:${recruitmentId}`, JSON.stringify(recruitment))

  // Remove from active recruitments
  await redis.del(`player:${recruitment.creator.id}:active_recruitment:${recruitment.tournamentId}`)

  // Add to queue
  const entry = await addToQueue(recruitment.setupId, recruitment.creator, player, recruitmentId)
  return entry
}

export async function cancelRecruitment(recruitmentId: string, playerId: string): Promise<boolean> {
  const recruitment = await getRecruitment(recruitmentId)
  if (!recruitment || recruitment.status !== 'open') return false
  if (recruitment.creator.id !== playerId) return false

  recruitment.status = 'cancelled'
  await redis.set(`recruitment:${recruitmentId}`, JSON.stringify(recruitment))
  await redis.srem(`setup:${recruitment.setupId}:recruitments`, recruitmentId)
  await redis.del(`player:${playerId}:active_recruitment:${recruitment.tournamentId}`)
  return true
}

async function getPlayerActiveRecruitment(playerId: string, tournamentId: string): Promise<Recruitment | null> {
  const id = await redis.get<string>(`player:${playerId}:active_recruitment:${tournamentId}`)
  if (!id) return null
  const r = await getRecruitment(id)
  if (!r || r.status !== 'open') {
    await redis.del(`player:${playerId}:active_recruitment:${tournamentId}`)
    return null
  }
  if (r.expiresAt <= Date.now()) {
    r.status = 'expired'
    await redis.set(`recruitment:${id}`, JSON.stringify(r))
    await redis.srem(`setup:${r.setupId}:recruitments`, id)
    await redis.del(`player:${playerId}:active_recruitment:${tournamentId}`)
    return null
  }
  return r
}

// === Queue ===

async function addToQueue(setupId: string, player1: Player, player2: Player, recruitmentId: string): Promise<QueueEntry> {
  const id = generateId()
  const queueLength = await redis.llen(`setup:${setupId}:queue`)
  const entry: QueueEntry = {
    id,
    setupId,
    player1,
    player2,
    recruitmentId,
    position: queueLength,
    createdAt: Date.now(),
    status: 'waiting',
  }
  await redis.set(`queue:${id}`, JSON.stringify(entry))
  await redis.rpush(`setup:${setupId}:queue`, id)

  // If setup is idle, start the match immediately
  const setup = await getSetup(setupId)
  if (setup && setup.status === 'idle') {
    await startNextMatch(setupId)
  }

  return entry
}

export async function getQueue(setupId: string): Promise<QueueEntry[]> {
  const ids = await redis.lrange(`setup:${setupId}:queue`, 0, -1)
  const entries: QueueEntry[] = []
  for (const id of ids) {
    const data = await redis.get(`queue:${id}`)
    const entry = parse<QueueEntry>(data)
    if (entry) entries.push(entry)
  }
  return entries
}

export async function removeFromQueue(setupId: string, entryId: string): Promise<void> {
  await redis.lrem(`setup:${setupId}:queue`, 0, entryId)
  await redis.del(`queue:${entryId}`)
}

// === Match ===

export async function startNextMatch(setupId: string): Promise<Match | null> {
  const queueId = await redis.lpop(`setup:${setupId}:queue`)
  if (!queueId || typeof queueId !== 'string') return null

  const entryData = await redis.get(`queue:${queueId}`)
  const entry = parse<QueueEntry>(entryData)
  if (!entry) return null

  const id = generateId()
  const now = Date.now()
  const match: Match = {
    id,
    setupId,
    player1: entry.player1,
    player2: entry.player2,
    startedAt: now,
    endsAt: now + (await getTimerForSetup(setupId)).callingTimeout,
    status: 'calling',
    player1Ready: false,
    player2Ready: false,
  }

  await redis.set(`match:${id}`, JSON.stringify(match))

  // Update setup
  const setup = await getSetup(setupId)
  if (setup) {
    setup.status = 'calling'
    setup.currentMatch = match
    await updateSetup(setup)
  }

  // Update queue entry
  entry.status = 'calling'
  await redis.set(`queue:${queueId}`, JSON.stringify(entry))

  return match
}

export async function playerReady(matchId: string, playerId: string): Promise<Match | null> {
  const data = await redis.get(`match:${matchId}`)
  if (!data) return null
  const match = parse<Match>(data)!

  if (match.player1.id === playerId) match.player1Ready = true
  if (match.player2.id === playerId) match.player2Ready = true

  // Both ready → start match
  if (match.player1Ready && match.player2Ready) {
    const now = Date.now()
    match.status = 'active'
    match.startedAt = now
    match.endsAt = now + (await getTimerForSetup(match.setupId)).matchDuration

    const setup = await getSetup(match.setupId)
    if (setup) {
      setup.status = 'in_use'
      setup.currentMatch = match
      await updateSetup(setup)
    }
  }

  await redis.set(`match:${matchId}`, JSON.stringify(match))
  return match
}

export async function endMatch(matchId: string): Promise<void> {
  const data = await redis.get(`match:${matchId}`)
  if (!data) return
  const match = parse<Match>(data)!

  match.status = 'finished'
  await redis.set(`match:${matchId}`, JSON.stringify(match))

  const setup = await getSetup(match.setupId)
  if (setup) {
    setup.status = 'idle'
    setup.currentMatch = null
    await updateSetup(setup)

    // Start next match if queue is not empty
    await startNextMatch(match.setupId)
  }
}

// === Match time check ===

export async function checkMatchTimeout(setupId: string): Promise<{ expired: boolean; fiveMinWarning: boolean }> {
  const setup = await getSetup(setupId)
  if (!setup || !setup.currentMatch || setup.currentMatch.status !== 'active') {
    return { expired: false, fiveMinWarning: false }
  }

  const match = setup.currentMatch
  const now = Date.now()
  const remaining = match.endsAt - now

  // Match expired
  if (remaining <= 0) {
    await endMatch(match.id)
    return { expired: true, fiveMinWarning: false }
  }

  // Warning before end (between warning-3s and warning to avoid repeat alerts)
  const tournament = await getTournament(setup.tournamentId)
  const timer = getTimerMs(tournament?.timerSettings)
  if (remaining <= timer.fiveMinWarning && remaining > timer.fiveMinWarning - 3000) {
    return { expired: false, fiveMinWarning: true }
  }

  return { expired: false, fiveMinWarning: false }
}

// === Calling timeout check ===

export async function checkCallingTimeout(setupId: string): Promise<{ timedOut: boolean; penalized: string[] }> {
  const setup = await getSetup(setupId)
  if (!setup || !setup.currentMatch || setup.currentMatch.status !== 'calling') {
    return { timedOut: false, penalized: [] }
  }

  const match = setup.currentMatch
  const now = Date.now()

  // Not timed out yet
  if (match.endsAt > now) {
    return { timedOut: false, penalized: [] }
  }

  // Timed out — penalize players who didn't press ready
  const penalized: string[] = []
  if (!match.player1Ready) {
    await addPenalty(match.player1.id, setup.tournamentId)
    penalized.push(match.player1.name || match.player1.xUsername)
  }
  if (!match.player2Ready) {
    await addPenalty(match.player2.id, setup.tournamentId)
    penalized.push(match.player2.name || match.player2.xUsername)
  }

  // Cancel the match
  match.status = 'finished'
  await redis.set(`match:${match.id}`, JSON.stringify(match))

  // Reset setup and start next match
  setup.status = 'idle'
  setup.currentMatch = null
  await updateSetup(setup)
  await startNextMatch(setupId)

  return { timedOut: true, penalized }
}

// === Force operations (organizer) ===

export async function forceEndMatch(setupId: string): Promise<void> {
  const setup = await getSetup(setupId)
  if (!setup || !setup.currentMatch) return
  await endMatch(setup.currentMatch.id)
}

export async function forceRemoveFromQueue(setupId: string, entryId: string): Promise<void> {
  await removeFromQueue(setupId, entryId)
}

// === Penalty ===

export async function addPenalty(playerId: string, tournamentId: string): Promise<void> {
  const timer = await getTimerForTournament(tournamentId)
  const penaltySec = Math.ceil(timer.penaltyDuration / 1000)
  const penalty: Penalty = {
    playerId,
    tournamentId,
    until: Date.now() + timer.penaltyDuration,
    reason: 'no_show',
  }
  await redis.set(`penalty:${playerId}:${tournamentId}`, JSON.stringify(penalty), { ex: penaltySec })
}

export async function getPlayerPenalty(playerId: string, tournamentId: string): Promise<Penalty | null> {
  const data = await redis.get(`penalty:${playerId}:${tournamentId}`)
  const penalty = parse<Penalty>(data)
  if (!penalty) return null
  if (penalty.until < Date.now()) return null
  return penalty
}

// === Player Tournaments ===

export async function getPlayerTournaments(playerId: string): Promise<Tournament[]> {
  const ids = await redis.smembers(`player:${playerId}:tournaments`)
  const tournaments: Tournament[] = []
  for (const id of ids) {
    const t = await getTournament(id)
    if (t) tournaments.push(t)
  }
  return tournaments.sort((a, b) => b.createdAt - a.createdAt)
}

// === Templates ===

const DEFAULT_TEMPLATES = [
  "レート1500前後",
  "レート1600前後",
  "レート1700前後",
  "レート1800以上",
  "おま3",
  "おま5",
  "誰でもOK",
]

export async function getTemplates(tournamentId: string): Promise<string[]> {
  const data = await redis.get(`tournament:${tournamentId}:templates`)
  const templates = parse<string[]>(data)
  return templates || DEFAULT_TEMPLATES
}

export async function saveTemplates(tournamentId: string, templates: string[]): Promise<void> {
  await redis.set(`tournament:${tournamentId}:templates`, JSON.stringify(templates))
}
