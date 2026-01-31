-- Verify metadata fields in songs table
-- Run this in Supabase SQL Editor to confirm all fields exist

-- NOTE: If columns already exist in your database, you can skip this script.
-- This script is provided for reference and verification purposes.

-- Add new columns to songs table (IF NOT EXISTS - safe to run)
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS album VARCHAR(255),  -- Album name
ADD COLUMN IF NOT EXISTS iswc VARCHAR(15),    -- International Standard Musical Work Code (T-123.456.789-C)
ADD COLUMN IF NOT EXISTS ipi TEXT,            -- Interested Party Information (can be multiple, comma-separated)
ADD COLUMN IF NOT EXISTS code VARCHAR(50);    -- Código de Obra

-- Add comments for documentation
COMMENT ON COLUMN songs.album IS 'Album name';
COMMENT ON COLUMN songs.iswc IS 'International Standard Musical Work Code (formato: T-123.456.789-C)';
COMMENT ON COLUMN songs.ipi IS 'Interested Party Information - números IPI separados por comas';
COMMENT ON COLUMN songs.code IS 'Código de Obra interno';

-- Verify all metadata columns exist
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'songs'
  AND column_name IN ('album', 'isrc', 'iswc', 'ipi', 'code', 'author')
ORDER BY column_name;
