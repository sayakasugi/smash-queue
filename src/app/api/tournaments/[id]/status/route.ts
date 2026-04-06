import { NextRequest, NextResponse } from 'next/server'
import { getSetups, getSetupRecruitments, getQueue } from '@/lib/tournament'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const setups = await getSetups(id)
  const result = await Promise.all(setups.map(async (setup) => {
    const recruitments = await getSetupRecruitments(setup.id)
    const queue = await getQueue(setup.id)
    return { ...setup, recruitCount: recruitments.length, queueCount: queue.length }
  }))
  return NextResponse.json(result)
}
