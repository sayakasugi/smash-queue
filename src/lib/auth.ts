import { cookies } from 'next/headers'
import { redis } from './redis'
import bcrypt from 'bcryptjs'

export type SessionUser = {
  id: string
  name: string
  xUsername: string
}

export type UserProfile = {
  id: string
  xUsername: string
  name: string
  passwordHash: string
  createdAt: number
  matchCount: number
  tournamentCount: number
}

// === Session ===

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
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('smashqueue_session')
}

// === User CRUD ===

export async function registerUser(xUsername: string, password: string, name?: string): Promise<UserProfile | null> {
  const id = xUsername.toLowerCase()

  // Check if already exists
  const existing = await redis.get(`user:${id}`)
  if (existing) return null

  const passwordHash = await bcrypt.hash(password, 10)
  const profile: UserProfile = {
    id,
    xUsername,
    name: name || xUsername,
    passwordHash,
    createdAt: Date.now(),
    matchCount: 0,
    tournamentCount: 0,
  }

  await redis.set(`user:${id}`, JSON.stringify(profile))
  return profile
}

export async function loginUser(xUsername: string, password: string): Promise<UserProfile | null> {
  const id = xUsername.toLowerCase()
  const data = await redis.get(`user:${id}`)
  if (!data) return null

  const profile: UserProfile = typeof data === 'string' ? JSON.parse(data) : data as UserProfile
  const valid = await bcrypt.compare(password, profile.passwordHash)
  if (!valid) return null

  return profile
}

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  const data = await redis.get(`user:${id}`)
  if (!data) return null
  return typeof data === 'string' ? JSON.parse(data) : data as UserProfile
}

export async function updateUserProfile(id: string, updates: { name?: string; password?: string }): Promise<UserProfile | null> {
  const profile = await getUserProfile(id)
  if (!profile) return null

  if (updates.name) profile.name = updates.name
  if (updates.password) profile.passwordHash = await bcrypt.hash(updates.password, 10)

  await redis.set(`user:${id}`, JSON.stringify(profile))
  return profile
}

export async function incrementMatchCount(userId: string): Promise<void> {
  const profile = await getUserProfile(userId)
  if (profile) {
    profile.matchCount = (profile.matchCount || 0) + 1
    await redis.set(`user:${userId}`, JSON.stringify(profile))
  }
}
