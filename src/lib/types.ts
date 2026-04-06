// === Core Types ===

export type TimerSettings = {
  matchDuration: number // 対戦時間（分）
  recruitmentExpiry: number // 募集期限（分）
  callingTimeout: number // 呼び出し猶予（分）
  fiveMinWarning: number // 終了前通知（分）
  penaltyDuration: number // ペナルティ時間（分）
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  matchDuration: 30,
  recruitmentExpiry: 10,
  callingTimeout: 5,
  fiveMinWarning: 5,
  penaltyDuration: 10,
}

export type Tournament = {
  id: string
  name: string
  code: string // 参加用コード（6桁）
  organizerId: string
  organizerName: string
  createdAt: number
  status: 'active' | 'archived'
  timerSettings?: TimerSettings
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

// Helper: get timer in ms from tournament settings
export function getTimerMs(settings?: TimerSettings) {
  const s = settings || DEFAULT_TIMER_SETTINGS
  return {
    matchDuration: s.matchDuration * 60 * 1000,
    recruitmentExpiry: s.recruitmentExpiry * 60 * 1000,
    callingTimeout: s.callingTimeout * 60 * 1000,
    fiveMinWarning: s.fiveMinWarning * 60 * 1000,
    penaltyDuration: s.penaltyDuration * 60 * 1000,
  }
}
