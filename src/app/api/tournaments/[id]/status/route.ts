import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Fetch all data in parallel with minimal queries
  const [setupsRes, recruitmentsRes, queueRes] = await Promise.all([
    supabase.from('setups').select().eq('tournament_id', id),
    supabase.from('recruitments').select('setup_id').eq('tournament_id', id).eq('status', 'open'),
    supabase.from('queue_entries').select('setup_id').eq('tournament_id', id).in('status', ['waiting', 'calling']),
  ])

  const setups = (setupsRes.data || [])
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ja', { numeric: true }))

  // Count per setup
  const recruitCounts: Record<string, number> = {}
  for (const r of recruitmentsRes.data || []) {
    recruitCounts[r.setup_id] = (recruitCounts[r.setup_id] || 0) + 1
  }
  const queueCounts: Record<string, number> = {}
  for (const q of queueRes.data || []) {
    queueCounts[q.setup_id] = (queueCounts[q.setup_id] || 0) + 1
  }

  const result = setups.map((s: { id: string }) => ({
    ...s,
    recruitCount: recruitCounts[s.id] || 0,
    queueCount: queueCounts[s.id] || 0,
  }))

  return NextResponse.json(result)
}
