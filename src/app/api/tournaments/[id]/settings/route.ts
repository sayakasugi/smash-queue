import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTournament } from '@/lib/tournament'
import { redis } from '@/lib/redis'
import type { TimerSettings } from '@/lib/types'
import { DEFAULT_TIMER_SETTINGS } from '@/lib/types'

// GET: タイマー設定取得
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  return NextResponse.json(tournament.timerSettings || DEFAULT_TIMER_SETTINGS)
}

// PUT: タイマー設定更新（主催者のみ）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  if (tournament.organizerId !== user.id) return NextResponse.json({ error: '主催者のみ操作可能です' }, { status: 403 })

  const settings: TimerSettings = await req.json()

  // Validate
  if (settings.matchDuration < 1 || settings.matchDuration > 120) return NextResponse.json({ error: '対戦時間は1〜120分' }, { status: 400 })
  if (settings.recruitmentExpiry < 1 || settings.recruitmentExpiry > 60) return NextResponse.json({ error: '募集期限は1〜60分' }, { status: 400 })
  if (settings.callingTimeout < 1 || settings.callingTimeout > 30) return NextResponse.json({ error: '呼び出し猶予は1〜30分' }, { status: 400 })
  if (settings.fiveMinWarning < 0 || settings.fiveMinWarning > settings.matchDuration) return NextResponse.json({ error: '終了前通知は対戦時間以下' }, { status: 400 })
  if (settings.penaltyDuration < 0 || settings.penaltyDuration > 60) return NextResponse.json({ error: 'ペナルティは0〜60分' }, { status: 400 })

  tournament.timerSettings = settings
  await redis.set(`tournament:${id}`, JSON.stringify(tournament))

  return NextResponse.json(settings)
}
