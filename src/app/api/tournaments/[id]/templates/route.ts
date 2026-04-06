import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTournament, getTemplates, saveTemplates } from '@/lib/tournament'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const templates = await getTemplates(id)
  return NextResponse.json(templates)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  if (tournament.organizer_id !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })

  const { templates } = await req.json()
  await saveTemplates(id, templates.filter((t: unknown) => typeof t === 'string' && (t as string).trim()))
  return NextResponse.json({ success: true })
}
