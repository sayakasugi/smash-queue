import { cookies } from 'next/headers'
import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

export type SessionUser = {
  id: string
  name: string
  xUsername: string
}

export type UserProfile = {
  id: string
  x_username: string
  name: string
  password_hash: string
  created_at: string
  match_count: number
  tournament_count: number
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
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('smashqueue_session')
}

// === User CRUD ===

// Normalize username: NFC normalization + lowercase for stable matching
function normalizeUsername(username: string): string {
  return username.normalize('NFC').toLowerCase().trim()
}

export async function registerUser(username: string, password: string, xUsername?: string) {
  const id = normalizeUsername(username)
  const name = username.normalize('NFC').trim()

  const { data: existing } = await supabase.from('users').select().eq('id', id).single()
  if (existing) return null

  const passwordHash = await bcrypt.hash(password, 10)
  const { data, error } = await supabase.from('users').insert({
    id,
    x_username: xUsername || '',
    name,
    password_hash: passwordHash,
  }).select().single()
  if (error) {
    console.error('Register error:', error)
    return null
  }
  return data as UserProfile
}

export async function loginUser(username: string, password: string) {
  // Try multiple normalizations to find the user
  const attempts = [
    normalizeUsername(username),
    username.toLowerCase().trim(),
    username.normalize('NFD').toLowerCase().trim(),
    username.trim(),
  ]
  const uniqueIds = [...new Set(attempts)]

  let profile: UserProfile | null = null
  for (const id of uniqueIds) {
    const { data } = await supabase.from('users').select().eq('id', id).single()
    if (data) {
      profile = data as UserProfile
      break
    }
  }

  if (!profile) {
    console.error('Login: user not found, tried IDs:', uniqueIds)
    return null
  }

  const valid = await bcrypt.compare(password, profile.password_hash)
  if (!valid) {
    console.error('Login: password mismatch for', profile.id)
    return null
  }

  return profile
}

export async function getUserProfile(id: string) {
  const { data } = await supabase.from('users').select().eq('id', id).single()
  return data as UserProfile | null
}

export async function updateUserProfile(id: string, updates: { name?: string; password?: string }) {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name) dbUpdates.name = updates.name
  if (updates.password) dbUpdates.password_hash = await bcrypt.hash(updates.password, 10)

  const { data } = await supabase.from('users').update(dbUpdates).eq('id', id).select().single()
  return data as UserProfile | null
}
