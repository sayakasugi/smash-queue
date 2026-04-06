import { NextRequest, NextResponse } from 'next/server'
import { getSession, getUserProfile, updateUserProfile } from '@/lib/auth'

// GET: プロフィール取得
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const profile = await getUserProfile(session.id)
  if (!profile) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })

  return NextResponse.json({
    xUsername: profile.xUsername,
    name: profile.name,
    createdAt: profile.createdAt,
    matchCount: profile.matchCount,
    tournamentCount: profile.tournamentCount,
  })
}

// PUT: プロフィール更新
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { name, password } = await req.json()
  const profile = await updateUserProfile(session.id, { name, password })
  if (!profile) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })

  // Update session with new name
  if (name) {
    const { setSession } = await import('@/lib/auth')
    await setSession({ id: profile.id, name: profile.name, xUsername: profile.xUsername })
  }

  return NextResponse.json({ success: true })
}
