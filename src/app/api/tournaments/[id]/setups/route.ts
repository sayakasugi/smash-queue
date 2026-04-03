import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTournament, createSetup, getSetups, deleteSetup } from '@/lib/tournament'

// GET: 台一覧
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const setups = await getSetups(id)
  return NextResponse.json(setups)
}

// POST: 台追加（主催者のみ）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })

  const xId = (session.user as { xId?: string }).xId
  if (tournament.organizerId !== xId) {
    return NextResponse.json({ error: '主催者のみ操作可能です' }, { status: 403 })
  }

  const { name } = await req.json()
  const setup = await createSetup(id, name)
  return NextResponse.json(setup, { status: 201 })
}

// DELETE: 台削除（主催者のみ）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })

  const xId = (session.user as { xId?: string }).xId
  if (tournament.organizerId !== xId) {
    return NextResponse.json({ error: '主催者のみ操作可能です' }, { status: 403 })
  }

  const { setupId } = await req.json()
  await deleteSetup(setupId, id)
  return NextResponse.json({ success: true })
}
