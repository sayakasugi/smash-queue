import { NextRequest, NextResponse } from 'next/server'
import { getTournament } from '@/lib/tournament'
import { getCached, setCache, CACHE_TTL } from '@/lib/cache'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cacheKey = `tournament:${id}`
    const cached = getCached(cacheKey)
    if (cached) return NextResponse.json(cached)

    const tournament = await getTournament(id)
    if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })

    setCache(cacheKey, tournament, CACHE_TTL.TOURNAMENT)
    return NextResponse.json(tournament)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
