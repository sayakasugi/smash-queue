import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSetups, getQueue, getSetupRecruitments } from '@/lib/tournament'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ hasRecruitment: false, inQueue: false, inMatch: false })

  const setups = await getSetups(id)
  let hasRecruitment = false, inQueue = false, inMatch = false, recruitmentSetupName = ""

  for (const setup of setups) {
    if (setup.current_match_id) {
      const { data: match } = await (await import('@/lib/supabase')).supabase.from('matches').select().eq('id', setup.current_match_id).single()
      if (match && (match.player1_id === user.id || match.player2_id === user.id)) inMatch = true
    }
    const queue = await getQueue(setup.id)
    if (queue.some((e: { player1_id: string; player2_id: string }) => e.player1_id === user.id || e.player2_id === user.id)) inQueue = true
    const recruitments = await getSetupRecruitments(setup.id)
    const my = recruitments.find((r: { creator_id: string }) => r.creator_id === user.id)
    if (my) { hasRecruitment = true; recruitmentSetupName = setup.name }
  }

  return NextResponse.json({ hasRecruitment, inQueue, inMatch, recruitmentSetupName })
}
