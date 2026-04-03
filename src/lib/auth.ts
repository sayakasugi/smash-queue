// Simple session management using cookies
// No OAuth - users just enter their X username

import { cookies } from 'next/headers'

export type SessionUser = {
  id: string
  name: string
  xUsername: string
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('smashqueue_session')
  if (!session?.value) return null
  try {
    return JSON.parse(session.value)
  } catch {
    return null
  }
}

export async function setSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('smashqueue_session', JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('smashqueue_session')
}
