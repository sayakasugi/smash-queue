// === Core Types ===

export type Tournament = {
  id: string
  name: string
  code: string // 参加用コード（6桁）
  organizerId: string
  organizerName: string
  createdAt: number
  status: 'active' | 'archived'
}

export type Setup = {
  id: string
  tournamentId: string
  name: string // 例: "台1", "Setup A"
  status: 'idle' | 'in_use' | 'calling' | 'disabled'
  currentMatch: Match | null
  queue: QueueEntry[]
}

export type Match = {
  id: string
  setupId: string
  player1: Player
  player2: Player
  startedAt: number
  endsAt: number // startedAt + 30分
  status: 'calling' | 'active' | 'finished'
  player1Ready: boolean
  player2Ready: boolean
}

export type Recruitment = {
  id: string
  setupId: string
  tournamentId: string
  creator: Player
  description: string // 自由記述
  template: string // テンプレート（例: "レート帯", "おま5"等）
  createdAt: number
  expiresAt: number // createdAt + 10分
  status: 'open' | 'matched' | 'expired' | 'cancelled'
  joinedBy: Player | null
}

export type QueueEntry = {
  id: string
  setupId: string
  player1: Player
  player2: Player
  recruitmentId: string
  position: number
  createdAt: number
  status: 'waiting' | 'calling' | 'active' | 'completed' | 'no_show'
}

export type Player = {
  id: string // X (Twitter) ID
  name: string // 表示名
  xUsername: string // @ユーザー名
}

export type Notification = {
  id: string
  playerId: string
  type: 'turn_coming' | 'five_min_warning' | 'time_up' | 'recruitment_matched'
  message: string
  createdAt: number
  read: boolean
}

export type Penalty = {
  playerId: string
  tournamentId: string
  until: number // ペナルティ解除時刻
  reason: 'no_show'
}

// === Timer Constants ===

export const TIMER = {
  MATCH_DURATION: 30 * 60 * 1000, // 30分
  RECRUITMENT_EXPIRY: 10 * 60 * 1000, // 10分
  CALLING_TIMEOUT: 5 * 60 * 1000, // 5分
  FIVE_MIN_WARNING: 5 * 60 * 1000, // 終了5分前
  PENALTY_DURATION: 10 * 60 * 1000, // 10分ペナルティ
} as const
