import { NextRequest, NextResponse } from 'next/server'
import { getSetups, getSetupRecruitments, getQueue } from '@/lib/tournament'

// GET: 全台のステータス一括取得（募集数・キュー数含む）
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const setups = await getSetups(id)

  const result = await Promise.all(setups.map(async (setup) => {
    const recruitments = await getSetupRecruitments(setup.id)
    const queue = await getQueue(setup.id)
    return {
      ...setup,
      recruitCount: recruitments.length,
      queueCount: queue.length,
    }
  }))

  return NextResponse.json(result)
}
