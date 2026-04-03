import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// === Key Schema ===
// tournament:{id} → Tournament
// tournament:code:{code} → tournament id
// setup:{id} → Setup
// tournament:{id}:setups → Set of setup ids
// recruitment:{id} → Recruitment
// setup:{id}:recruitments → Set of recruitment ids
// setup:{id}:queue → List of QueueEntry ids
// queue:{id} → QueueEntry
// match:{id} → Match
// player:{xUsername} → Player
// penalty:{playerId}:{tournamentId} → Penalty
// notifications:{playerId} → List of Notification ids
// notification:{id} → Notification
