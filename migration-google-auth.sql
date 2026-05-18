-- SmashQueue: Google OAuth migration
-- Replaces custom users table with profiles linked to auth.users (UUID)
-- Safe to run only because there are NO existing users in production.

-- 1. Drop FK constraints referencing the old users table
ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_organizer_id_fkey;
ALTER TABLE tournament_participants
  DROP CONSTRAINT IF EXISTS tournament_participants_user_id_fkey;

-- 2. Drop the old users table
DROP TABLE IF EXISTS users CASCADE;

-- 3. Create profiles table keyed to auth.users.id (UUID)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  x_username TEXT,
  avatar_url TEXT,
  match_count INT DEFAULT 0,
  tournament_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 5. Trigger: auto-create profile on signup using Google metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Optional: backfill profiles for any auth.users that already exist
INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1)
  ),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
