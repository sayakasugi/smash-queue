import { NextRequest, NextResponse } from 'next/server'
import { getSession, setSession, clearSession, registerUser, loginUser } from '@/lib/auth'

// GET: セッション確認
export async function GET() {
  const user = await getSession()
  return NextResponse.json({ user: user || null })
}

// POST: ログイン or 登録
export async function POST(req: NextRequest) {
  const { xUsername, password, action, name } = await req.json()

  if (!xUsername || typeof xUsername !== 'string' || !password || typeof password !== 'string') {
    return NextResponse.json({ error: 'X IDとパスワードを入力してください' }, { status: 400 })
  }

  const cleaned = xUsername.replace(/^@/, '').trim()
  if (!cleaned) {
    return NextResponse.json({ error: 'X IDを入力してください' }, { status: 400 })
  }
  if (password.length < 4) {
    return NextResponse.json({ error: 'パスワードは4文字以上にしてください' }, { status: 400 })
  }

  // Register
  if (action === 'register') {
    const profile = await registerUser(cleaned, password, name?.trim())
    if (!profile) {
      return NextResponse.json({ error: 'このX IDは既に登録されています' }, { status: 409 })
    }
    const user = { id: profile.id, name: profile.name, xUsername: profile.xUsername }
    await setSession(user)
    return NextResponse.json({ user })
  }

  // Login
  const profile = await loginUser(cleaned, password)
  if (!profile) {
    return NextResponse.json({ error: 'X IDまたはパスワードが正しくありません' }, { status: 401 })
  }

  const user = { id: profile.id, name: profile.name, xUsername: profile.xUsername }
  await setSession(user)
  return NextResponse.json({ user })
}

// DELETE: ログアウト
export async function DELETE() {
  await clearSession()
  return NextResponse.json({ success: true })
}
