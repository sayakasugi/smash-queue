import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSetup, getQueue, playerReady, endMatch, forceEndMatch, forceRemoveFromQueue, getTournament } from '@/lib/tournament'

// GET: 台の状態（現在の対戦 + キュー）
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const setup = await getSetup(id)
  if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })

  const queue = await getQueue(id)
  return NextResponse.json({ setup, queue })
}

// POST: 対戦操作（ready / end / force_end / force_remove）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: setupId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const xId = (session.user as { xId?: string }).xId
  if (!xId) return NextResponse.json({ error: 'プレイヤー情報が不足' }, { status: 400 })

  const body = await req.json()

  // プレイヤーが席についた
  if (body.action === 'ready') {
    const match = await playerReady(body.matchId, xId)
    if (!match) return NextResponse.json({ error: '操作できません' }, { status: 400 })
    return NextResponse.json(match)
  }

  // 対戦終了
  if (body.action === 'end') {
    await endMatch(body.matchId)
    return NextResponse.json({ success: true })
  }

  // 主催者操作: 強制終了
  if (body.action === 'force_end') {
    const setup = await getSetup(setupId)
    if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })
    const tournament = await getTournament(setup.tournamentId)
    if (!tournament || tournament.organizerId !== xId) {
      return NextResponse.json({ error: '主催者のみ操作可能です' }, { status: 403 })
    }
    await forceEndMatch(setupId)
    return NextResponse.json({ success: true })
  }

  // 主催者操作: キューから削除
  if (body.action === 'force_remove') {
    const setup = await getSetup(setupId)
    if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })
    const tournament = await getTournament(setup.tournamentId)
    if (!tournament || tournament.organizerId !== xId) {
      return NextResponse.json({ error: '主催者のみ操作可能です' }, { status: 403 })
    }
    await forceRemoveFromQueue(setupId, body.entryId)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: '不正なアクション' }, { status: 400 })
}
