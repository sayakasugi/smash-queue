import { NextRequest, NextResponse } from 'next/server'
import { getTournament } from '@/lib/tournament'

// GET: 大会情報（認証不要）
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tournament = await getTournament(id)
    if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
    return NextResponse.json(tournament)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
