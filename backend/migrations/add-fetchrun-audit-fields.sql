-- Migration: Add requestId and providerStatus to FetchRun
-- Run this with: cat backend/migrations/add-fetchrun-audit-fields.sql | docker compose --profile dev exec -T postgres psql -U staycation -d staycation_db

-- Add requestId column
ALTER TABLE fetch_runs ADD COLUMN IF NOT EXISTS "requestId" VARCHAR;

-- Add providerStatus enum type
DO $$ BEGIN
    CREATE TYPE provider_status AS ENUM ('OK', 'FETCH_FAILED', 'PARSE_FAILED', 'BLOCKED', 'TIMEOUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add providerStatus column
ALTER TABLE fetch_runs ADD COLUMN IF NOT EXISTS "providerStatus" provider_status;

-- Create index on requestId for faster lookups
CREATE INDEX IF NOT EXISTS idx_fetch_runs_request_id ON fetch_runs("requestId");

-- Add comments for documentation
COMMENT ON COLUMN fetch_runs."requestId" IS 'UUID of the preview request that triggered this fetch';
COMMENT ON COLUMN fetch_runs."providerStatus" IS 'Detailed status of provider execution (OK, FETCH_FAILED, PARSE_FAILED, BLOCKED, TIMEOUT)';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'fetch_runs' 
AND column_name IN ('requestId', 'providerStatus')
ORDER BY column_name;
