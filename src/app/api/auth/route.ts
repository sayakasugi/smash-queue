import { NextRequest, NextResponse } from 'next/server'
import { getSession, setSession, clearSession, registerUser, loginUser, resetPasswordByXId } from '@/lib/auth'

// GET: セッション確認
export async function GET() {
  const user = await getSession()
  return NextResponse.json({ user: user || null })
}

// POST: ログイン or 登録 or パスワード再設定
export async function POST(req: NextRequest) {
  const { username, password, action, xUsername } = await req.json()

  // Password reset
  if (action === 'reset') {
    if (!username || !xUsername || !password) {
      return NextResponse.json({ error: 'ユーザー名・X ID・新パスワードを入力してください' }, { status: 400 })
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'パスワードは4文字以上にしてください' }, { status: 400 })
    }
    const xClean = xUsername.replace(/^@/, '').trim()
    const profile = await resetPasswordByXId(username.trim(), xClean, password)
    if (!profile) {
      return NextResponse.json({ error: 'ユーザー名とX IDの組み合わせが一致しません' }, { status: 401 })
    }
    const user = { id: profile.id, name: profile.name, xUsername: profile.x_username }
    await setSession(user)
    return NextResponse.json({ user })
  }

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return NextResponse.json({ error: 'ユーザー名とパスワードを入力してください' }, { status: 400 })
  }

  const cleaned = username.trim()
  if (!cleaned || cleaned.length < 2) {
    return NextResponse.json({ error: 'ユーザー名は2文字以上にしてください' }, { status: 400 })
  }
  if (password.length < 4) {
    return NextResponse.json({ error: 'パスワードは4文字以上にしてください' }, { status: 400 })
  }

  // Register (X ID required)
  if (action === 'register') {
    if (!xUsername || typeof xUsername !== 'string' || !xUsername.trim()) {
      return NextResponse.json({ error: 'X IDは必須です' }, { status: 400 })
    }
    const xClean = xUsername.replace(/^@/, '').trim()
    const profile = await registerUser(cleaned, password, xClean)
    if (!profile) {
      return NextResponse.json({ error: 'このユーザー名は既に登録されています' }, { status: 409 })
    }
    const user = { id: profile.id, name: profile.name, xUsername: profile.x_username }
    await setSession(user)
    return NextResponse.json({ user })
  }

  // Login
  const profile = await loginUser(cleaned, password)
  if (!profile) {
    return NextResponse.json({ error: 'ユーザー名またはパスワードが正しくありません' }, { status: 401 })
  }

  const user = { id: profile.id, name: profile.name, xUsername: profile.x_username }
  await setSession(user)
  return NextResponse.json({ user })
}

// DELETE: ログアウト
export async function DELETE() {
  await clearSession()
  return NextResponse.json({ success: true })
}
