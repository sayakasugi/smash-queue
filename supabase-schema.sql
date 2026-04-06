-- SmashQueue Database Schema

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- x username (lowercase)
  x_username TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  match_count INT DEFAULT 0,
  tournament_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments
CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  organizer_id TEXT NOT NULL REFERENCES users(id),
  organizer_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  match_duration INT DEFAULT 30,
  recruitment_expiry INT DEFAULT 10,
  calling_timeout INT DEFAULT 5,
  five_min_warning INT DEFAULT 5,
  penalty_duration INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament participants
CREATE TABLE tournament_participants (
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  PRIMARY KEY (tournament_id, user_id)
);

-- Setups (tables/stations)
CREATE TABLE setups (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'idle', -- idle, in_use, calling, disabled
  current_match_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  setup_id TEXT NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id TEXT NOT NULL,
  player1_name TEXT NOT NULL,
  player1_x TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  player2_x TEXT NOT NULL,
  player1_ready BOOLEAN DEFAULT FALSE,
  player2_ready BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'calling', -- calling, active, finished
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Queue entries
CREATE TABLE queue_entries (
  id TEXT PRIMARY KEY,
  setup_id TEXT NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id TEXT NOT NULL,
  player1_name TEXT NOT NULL,
  player1_x TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  player2_x TEXT NOT NULL,
  recruitment_id TEXT,
  position INT NOT NULL,
  status TEXT DEFAULT 'waiting', -- waiting, calling, active, completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recruitments
CREATE TABLE recruitments (
  id TEXT PRIMARY KEY,
  setup_id TEXT NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  creator_x TEXT NOT NULL,
  template TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'open', -- open, matched, expired, cancelled
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Penalties
CREATE TABLE penalties (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  reason TEXT DEFAULT 'no_show',
  until_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates
CREATE TABLE templates (
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  templates TEXT[] DEFAULT ARRAY['レート1500前後','レート1600前後','レート1700前後','レート1800以上','おま3','おま5','誰でもOK'],
  PRIMARY KEY (tournament_id)
);

-- Indexes
CREATE INDEX idx_setups_tournament ON setups(tournament_id);
CREATE INDEX idx_matches_setup ON matches(setup_id);
CREATE INDEX idx_queue_setup ON queue_entries(setup_id);
CREATE INDEX idx_recruitments_setup ON recruitments(setup_id);
CREATE INDEX idx_recruitments_status ON recruitments(status);
CREATE INDEX idx_penalties_player ON penalties(player_id, tournament_id);
CREATE INDEX idx_tournaments_code ON tournaments(code);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE setups;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE recruitments;

-- Row Level Security (allow all for now, can be tightened later)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Policies (allow everything via anon key for simplicity)
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tournaments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tournament_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON setups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON queue_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON recruitments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON penalties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON templates FOR ALL USING (true) WITH CHECK (true);
