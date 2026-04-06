import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTournament, getTemplates, saveTemplates } from '@/lib/tournament'
import { getCached, setCache, invalidateCache, CACHE_TTL } from '@/lib/cache'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cacheKey = `templates:${id}`
  const cached = getCached(cacheKey)
  if (cached) return NextResponse.json(cached)

  const templates = await getTemplates(id)
  setCache(cacheKey, templates, CACHE_TTL.TEMPLATES)
  return NextResponse.json(templates)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSession()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const tournament = await getTournament(id)
  if (!tournament) return NextResponse.json({ error: '大会が見つかりません' }, { status: 404 })
  if (tournament.organizerId !== user.id) return NextResponse.json({ error: '主催者のみ操作可能です' }, { status: 403 })

  const { templates } = await req.json()
  if (!Array.isArray(templates)) return NextResponse.json({ error: '不正なデータ' }, { status: 400 })

  await saveTemplates(id, templates.filter((t: unknown) => typeof t === 'string' && t.trim()))
  invalidateCache(`templates:${id}`)
  return NextResponse.json({ success: true })
}
