import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createRecruitment, getSetupRecruitments, joinRecruitment, cancelRecruitment, getSetup } from '@/lib/tournament'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recruitments = await getSetupRecruitments(id)
  return NextResponse.json(recruitments)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: setupId } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'join') {
    const entry = await joinRecruitment(body.recruitmentId, user)
    if (!entry) return NextResponse.json({ error: '参加できません' }, { status: 400 })
    return NextResponse.json(entry)
  }

  if (body.action === 'cancel') {
    const ok = await cancelRecruitment(body.recruitmentId, user.id)
    if (!ok) return NextResponse.json({ error: 'キャンセルできません' }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  const setup = await getSetup(setupId)
  if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })

  const recruitment = await createRecruitment(setupId, setup.tournamentId, user, body.template || '', body.description || '')
  if (!recruitment) return NextResponse.json({ error: '既に募集中か、ペナルティ中です' }, { status: 400 })
  return NextResponse.json(recruitment, { status: 201 })
}
