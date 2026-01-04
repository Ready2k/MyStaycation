-- Migration: Add requestId and providerStatus to FetchRun
-- Created: 2026-01-04
-- Purpose: Enhanced audit logging for preview endpoint (TOFU implementation)

-- Add requestId column
ALTER TABLE fetch_runs 
ADD COLUMN IF NOT EXISTS "requestId" VARCHAR;

-- Add providerStatus enum type
DO $$ BEGIN
    CREATE TYPE provider_status AS ENUM ('OK', 'FETCH_FAILED', 'PARSE_FAILED', 'BLOCKED', 'TIMEOUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add providerStatus column
ALTER TABLE fetch_runs 
ADD COLUMN IF NOT EXISTS "providerStatus" provider_status;

-- Create index on requestId for faster lookups
CREATE INDEX IF NOT EXISTS idx_fetch_runs_request_id ON fetch_runs("requestId");

-- Add comment for documentation
COMMENT ON COLUMN fetch_runs."requestId" IS 'UUID of the preview request that triggered this fetch';
COMMENT ON COLUMN fetch_runs."providerStatus" IS 'Detailed status of provider execution (OK, FETCH_FAILED, PARSE_FAILED, BLOCKED, TIMEOUT)';
