import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ hasRecruitment: false, inQueue: false, inMatch: false })

  // Parallel queries
  const [matchRes, queueRes, recruitRes, penaltyRes] = await Promise.all([
    supabase.from('matches').select('id, player1_id, player2_id, setup_id').eq('tournament_id', id).in('status', ['calling', 'active']),
    supabase.from('queue_entries').select('id, player1_id, player2_id').eq('tournament_id', id).in('status', ['waiting', 'calling']),
    supabase.from('recruitments').select('id, creator_id, setup_id').eq('tournament_id', id).eq('status', 'open'),
    supabase.from('penalties').select('until_at').eq('player_id', user.id).eq('tournament_id', id).gt('until_at', new Date().toISOString()).order('until_at', { ascending: false }).limit(1),
  ])

  const inMatch = (matchRes.data || []).some(m => m.player1_id === user.id || m.player2_id === user.id)
  const inQueue = (queueRes.data || []).some(q => q.player1_id === user.id || q.player2_id === user.id)
  const myRecruitment = (recruitRes.data || []).find(r => r.creator_id === user.id)

  let recruitmentSetupName = ""
  if (myRecruitment) {
    const { data: setup } = await supabase.from('setups').select('name').eq('id', myRecruitment.setup_id).single()
    recruitmentSetupName = setup?.name || ""
  }

  const penalty = penaltyRes.data && penaltyRes.data.length > 0 ? penaltyRes.data[0] : null
  return NextResponse.json({
    hasRecruitment: !!myRecruitment, inQueue, inMatch, recruitmentSetupName,
    hasPenalty: !!penalty,
    penaltyUntil: penalty?.until_at || null,
  })
}
