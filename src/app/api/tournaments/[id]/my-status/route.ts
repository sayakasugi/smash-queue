import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSetups, getQueue, getSetupRecruitments } from '@/lib/tournament'
import { getCached, setCache, CACHE_TTL } from '@/lib/cache'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ hasRecruitment: false, inQueue: false, inMatch: false })

  const cacheKey = `mystatus:${id}:${user.id}`
  const cached = getCached(cacheKey)
  if (cached) return NextResponse.json(cached)

  const setups = await getSetups(id)
  let hasRecruitment = false
  let inQueue = false
  let inMatch = false
  let recruitmentSetupName = ""

  for (const setup of setups) {
    if (setup.currentMatch) {
      if (setup.currentMatch.player1.id === user.id || setup.currentMatch.player2.id === user.id) {
        inMatch = true
      }
    }
    const queue = await getQueue(setup.id)
    if (queue.some(e => e.player1.id === user.id || e.player2.id === user.id)) {
      inQueue = true
    }
    const recruitments = await getSetupRecruitments(setup.id)
    const myRecruitment = recruitments.find(r => r.creator.id === user.id)
    if (myRecruitment) {
      hasRecruitment = true
      recruitmentSetupName = setup.name
    }
  }

  const result = { hasRecruitment, inQueue, inMatch, recruitmentSetupName }
  setCache(cacheKey, result, CACHE_TTL.MY_STATUS)
  return NextResponse.json(result)
}
