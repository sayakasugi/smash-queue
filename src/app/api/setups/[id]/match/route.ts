import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSetup, getQueue, playerReady, endMatch, forceEndMatch, forceRemoveFromQueue, getTournament, checkCallingTimeout, checkMatchTimeout } from '@/lib/tournament'
import { getCached, setCache, invalidateCache, CACHE_TTL } from '@/lib/cache'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Timeout checks always run (side effects)
  const timeoutResult = await checkCallingTimeout(id)
  const matchResult = await checkMatchTimeout(id)

  // If timeout happened, invalidate cache
  if (timeoutResult.timedOut || matchResult.expired) {
    invalidateCache(`match:${id}`)
    invalidateCache(`status:`)
  }

  const cacheKey = `match:${id}`
  const cached = getCached<{ setup: unknown; queue: unknown }>(cacheKey)

  let setup, queue
  if (cached && !timeoutResult.timedOut && !matchResult.expired) {
    setup = cached.setup
    queue = cached.queue
  } else {
    setup = await getSetup(id)
    if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })
    queue = await getQueue(id)
    setCache(cacheKey, { setup, queue }, CACHE_TTL.SETUP_DETAIL)
  }

  return NextResponse.json({
    setup,
    queue,
    ...(timeoutResult.timedOut ? { timeout: { penalized: timeoutResult.penalized } } : {}),
    ...(matchResult.expired ? { matchExpired: true } : {}),
    ...(matchResult.fiveMinWarning ? { fiveMinWarning: true } : {}),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: setupId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const body = await req.json()

  // Invalidate cache on any mutation
  invalidateCache(`match:${setupId}`)
  invalidateCache(`status:`)

  if (body.action === 'ready') {
    const match = await playerReady(body.matchId, user.id)
    if (!match) return NextResponse.json({ error: '操作できません' }, { status: 400 })
    return NextResponse.json(match)
  }

  if (body.action === 'end') {
    await endMatch(body.matchId)
    return NextResponse.json({ success: true })
  }

  if (body.action === 'force_end') {
    const setup = await getSetup(setupId)
    if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })
    const tournament = await getTournament(setup.tournamentId)
    if (!tournament || tournament.organizerId !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })
    await forceEndMatch(setupId)
    return NextResponse.json({ success: true })
  }

  if (body.action === 'force_remove') {
    const setup = await getSetup(setupId)
    if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })
    const tournament = await getTournament(setup.tournamentId)
    if (!tournament || tournament.organizerId !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })
    await forceRemoveFromQueue(setupId, body.entryId)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: '不正なアクション' }, { status: 400 })
}
