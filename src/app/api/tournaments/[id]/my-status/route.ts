import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSetups, getQueue, getSetupRecruitments } from '@/lib/tournament'

// GET: 自分の大会内ステータス（募集中か、キュー内か、対戦中か）
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ hasRecruitment: false, inQueue: false, inMatch: false })

  const setups = await getSetups(id)
  let hasRecruitment = false
  let inQueue = false
  let inMatch = false
  let recruitmentSetupName = ""

  for (const setup of setups) {
    // Check match
    if (setup.currentMatch) {
      if (setup.currentMatch.player1.id === user.id || setup.currentMatch.player2.id === user.id) {
        inMatch = true
      }
    }

    // Check queue
    const queue = await getQueue(setup.id)
    if (queue.some(e => e.player1.id === user.id || e.player2.id === user.id)) {
      inQueue = true
    }

    // Check recruitments
    const recruitments = await getSetupRecruitments(setup.id)
    const myRecruitment = recruitments.find(r => r.creator.id === user.id)
    if (myRecruitment) {
      hasRecruitment = true
      recruitmentSetupName = setup.name
    }
  }

  return NextResponse.json({ hasRecruitment, inQueue, inMatch, recruitmentSetupName })
}
