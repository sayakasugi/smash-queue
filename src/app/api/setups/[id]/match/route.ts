import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSetup, getQueue, getMatch, playerReady, endMatch, forceEndMatch, forceRemoveFromQueue, getTournament, checkCallingTimeout, checkMatchTimeout } from '@/lib/tournament'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const timeoutResult = await checkCallingTimeout(id)
  const matchResult = await checkMatchTimeout(id)

  const setup = await getSetup(id)
  if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })

  // Get current match data
  let currentMatch = null
  if (setup.current_match_id) {
    currentMatch = await getMatch(setup.current_match_id)
  }

  const queue = await getQueue(id)

  return NextResponse.json({
    setup: { ...setup, currentMatch: currentMatch },
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
    const tournament = await getTournament(setup.tournament_id)
    if (!tournament || tournament.organizer_id !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })
    await forceEndMatch(setupId)
    return NextResponse.json({ success: true })
  }

  if (body.action === 'force_remove') {
    const setup = await getSetup(setupId)
    if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })
    const tournament = await getTournament(setup.tournament_id)
    if (!tournament || tournament.organizer_id !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })
    await forceRemoveFromQueue(setupId, body.entryId)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: '不正なアクション' }, { status: 400 })
}
