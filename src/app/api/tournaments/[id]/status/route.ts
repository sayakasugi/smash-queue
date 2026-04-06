import { NextRequest, NextResponse } from 'next/server'
import { getSetups, getSetupRecruitments, getQueue } from '@/lib/tournament'
import { getCached, setCache, CACHE_TTL } from '@/lib/cache'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cacheKey = `status:${id}`

  const cached = getCached(cacheKey)
  if (cached) return NextResponse.json(cached)

  const setups = await getSetups(id)
  const result = await Promise.all(setups.map(async (setup) => {
    const recruitments = await getSetupRecruitments(setup.id)
    const queue = await getQueue(setup.id)
    return { ...setup, recruitCount: recruitments.length, queueCount: queue.length }
  }))

  setCache(cacheKey, result, CACHE_TTL.SETUP_STATUS)
  return NextResponse.json(result)
}
