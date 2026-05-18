-- Add onboarded flag to profiles for first-time setup flow

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false NOT NULL;

-- Existing rows (if any) treat as onboarded so they aren't forced through setup again
UPDATE profiles SET onboarded = true WHERE created_at < NOW();
