import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createTournament, joinTournament, getPlayerTournaments } from '@/lib/tournament'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournaments = await getPlayerTournaments(user.id)
  return NextResponse.json(tournaments)
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'join') {
    const tournament = await joinTournament(body.code, user)
    if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
    return NextResponse.json(tournament)
  }

  if (body.action === 'create') {
    const tournament = await createTournament(body.name, user)
    return NextResponse.json(tournament, { status: 201 })
  }

  return NextResponse.json({ error: '不正なアクション' }, { status: 400 })
}
