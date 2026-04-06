import { NextRequest, NextResponse } from 'next/server'
import { getSession, setSession, clearSession } from '@/lib/auth'

// GET: セッション確認
export async function GET() {
  const user = await getSession()
  return NextResponse.json({ user: user || null })
}

// POST: ログイン（X ID登録）
export async function POST(req: NextRequest) {
  const { xUsername, name } = await req.json()

  if (!xUsername || typeof xUsername !== 'string') {
    return NextResponse.json({ error: 'X IDを入力してください' }, { status: 400 })
  }

  const cleaned = xUsername.replace(/^@/, '').trim()
  if (!cleaned) {
    return NextResponse.json({ error: 'X IDを入力してください' }, { status: 400 })
  }

  const user = {
    id: cleaned.toLowerCase(),
    name: name?.trim() || cleaned,
    xUsername: cleaned,
  }

  await setSession(user)
  return NextResponse.json({ user })
}

// DELETE: ログアウト
export async function DELETE() {
  await clearSession()
  return NextResponse.json({ success: true })
}
