import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createTournament, getTournamentByCode, joinTournament, getPlayerTournaments } from '@/lib/tournament'
import type { Player } from '@/lib/types'

function getPlayer(session: { user?: { name?: string | null; xUsername?: string; xId?: string } }): Player | null {
  if (!session.user?.xId) return null
  return {
    id: session.user.xId,
    name: session.user.name || '',
    xUsername: (session.user as { xUsername?: string }).xUsername || '',
  }
}

// GET: 自分の大会一覧
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const player = getPlayer(session)
  if (!player) return NextResponse.json({ error: 'プレイヤー情報が不足' }, { status: 400 })

  const tournaments = await getPlayerTournaments(player.id)
  return NextResponse.json(tournaments)
}

// POST: 大会作成 or 参加
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const player = getPlayer(session)
  if (!player) return NextResponse.json({ error: 'プレイヤー情報が不足' }, { status: 400 })

  const body = await req.json()

  // 大会に参加
  if (body.action === 'join') {
    const tournament = await joinTournament(body.code, player)
    if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
    return NextResponse.json(tournament)
  }

  // 大会作成
  if (body.action === 'create') {
    const tournament = await createTournament(body.name, player)
    return NextResponse.json(tournament, { status: 201 })
  }

  return NextResponse.json({ error: '不正なアクション' }, { status: 400 })
}
