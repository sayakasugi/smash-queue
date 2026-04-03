import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createRecruitment, getSetupRecruitments, joinRecruitment, cancelRecruitment, getSetup } from '@/lib/tournament'
import type { Player } from '@/lib/types'

function getPlayer(session: { user?: { name?: string | null; xUsername?: string; xId?: string } }): Player | null {
  if (!session.user) return null
  const xId = (session.user as { xId?: string }).xId
  if (!xId) return null
  return {
    id: xId,
    name: session.user.name || '',
    xUsername: (session.user as { xUsername?: string }).xUsername || '',
  }
}

// GET: 台の募集一覧
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recruitments = await getSetupRecruitments(id)
  return NextResponse.json(recruitments)
}

// POST: 募集作成 or 参加
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: setupId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const player = getPlayer(session)
  if (!player) return NextResponse.json({ error: 'プレイヤー情報が不足' }, { status: 400 })

  const body = await req.json()

  // 募集に参加
  if (body.action === 'join') {
    const entry = await joinRecruitment(body.recruitmentId, player)
    if (!entry) return NextResponse.json({ error: '参加できません' }, { status: 400 })
    return NextResponse.json(entry)
  }

  // 募集キャンセル
  if (body.action === 'cancel') {
    const ok = await cancelRecruitment(body.recruitmentId, player.id)
    if (!ok) return NextResponse.json({ error: 'キャンセルできません' }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  // 募集作成
  const setup = await getSetup(setupId)
  if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })

  const recruitment = await createRecruitment(
    setupId,
    setup.tournamentId,
    player,
    body.template || '',
    body.description || '',
  )
  if (!recruitment) return NextResponse.json({ error: '既に募集中か、ペナルティ中です' }, { status: 400 })
  return NextResponse.json(recruitment, { status: 201 })
}
