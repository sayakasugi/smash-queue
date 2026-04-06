import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTournament, saveTimerSettings } from '@/lib/tournament'
import { DEFAULT_TIMER_SETTINGS } from '@/lib/types'
import type { TimerSettings } from '@/lib/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  return NextResponse.json({
    matchDuration: tournament.match_duration ?? DEFAULT_TIMER_SETTINGS.matchDuration,
    recruitmentExpiry: tournament.recruitment_expiry ?? DEFAULT_TIMER_SETTINGS.recruitmentExpiry,
    callingTimeout: tournament.calling_timeout ?? DEFAULT_TIMER_SETTINGS.callingTimeout,
    fiveMinWarning: tournament.five_min_warning ?? DEFAULT_TIMER_SETTINGS.fiveMinWarning,
    penaltyDuration: tournament.penalty_duration ?? DEFAULT_TIMER_SETTINGS.penaltyDuration,
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  if (tournament.organizer_id !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })

  const settings: TimerSettings = await req.json()
  await saveTimerSettings(id, settings)
  return NextResponse.json(settings)
}
