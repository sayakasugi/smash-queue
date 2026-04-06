import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTournament, createSetup, getSetups, deleteSetup, getSetup, updateSetup } from '@/lib/tournament'

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
  if (tournament.organizer_id !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })

  const body = await req.json()

  // Batch create
  if (body.from !== undefined && body.to !== undefined) {
    const prefix = body.prefix || '台'
    const from = Number(body.from)
    const to = Number(body.to)
    if (isNaN(from) || isNaN(to) || from > to || to - from > 200) {
      return NextResponse.json({ error: '範囲が不正です' }, { status: 400 })
    }
    const created = []
    for (let i = from; i <= to; i++) {
      const setup = await createSetup(id, `${prefix}${i}`)
      created.push(setup)
    }
    return NextResponse.json(created, { status: 201 })
  }

  const setup = await createSetup(id, body.name)
  return NextResponse.json(setup, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  if (tournament.organizer_id !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })

  try {
    const { setupId } = await req.json()
    await deleteSetup(setupId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  if (tournament.organizer_id !== user.id) return NextResponse.json({ error: '主催者のみ' }, { status: 403 })

  const body = await req.json()

  // Bulk operation
  if (Array.isArray(body.setupIds)) {
    for (const sid of body.setupIds) {
      await updateSetup(sid, { status: body.disabled ? 'disabled' : 'idle', current_match_id: body.disabled ? null : undefined })
    }
    return NextResponse.json({ success: true })
  }

  const setup = await getSetup(body.setupId)
  if (!setup) return NextResponse.json({ error: '台が見つかりません' }, { status: 404 })
  await updateSetup(body.setupId, { status: body.disabled ? 'disabled' : 'idle', current_match_id: body.disabled ? null : undefined })
  return NextResponse.json({ success: true })
}
