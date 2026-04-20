-- Add permanent profile picture URL to competitors
ALTER TABLE mait_competitors
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
