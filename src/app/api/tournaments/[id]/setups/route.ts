import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTournament, createSetup, getSetups, deleteSetup } from '@/lib/tournament'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const setups = await getSetups(id)
  return NextResponse.json(setups)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  if (tournament.organizerId !== user.id) return NextResponse.json({ error: '主催者のみ操作可能です' }, { status: 403 })

  const { name } = await req.json()
  const setup = await createSetup(id, name)
  return NextResponse.json(setup, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  if (tournament.organizerId !== user.id) return NextResponse.json({ error: '主催者のみ操作可能です' }, { status: 403 })

  const { setupId } = await req.json()
  await deleteSetup(setupId, id)
  return NextResponse.json({ success: true })
}
