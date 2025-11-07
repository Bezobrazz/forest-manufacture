-- Fix NULL confirmation_token issue in auth.users
-- This migration fixes the issue where confirmation_token is NULL
-- and causes "converting NULL to string is unsupported" error

-- Note: We cannot directly modify auth.users table structure,
-- but we can ensure that existing records have proper values

-- Update any NULL confirmation_token values to empty string
-- This is a workaround for the Supabase Auth API issue
UPDATE auth.users 
SET confirmation_token = '' 
WHERE confirmation_token IS NULL;

-- Also ensure recovery_token is not NULL if it exists
UPDATE auth.users 
SET recovery_token = '' 
WHERE recovery_token IS NULL;

-- Note: If you cannot execute UPDATE on auth.users directly,
-- you may need to:
-- 1. Delete problematic users and recreate them
-- 2. Or contact Supabase support
-- 3. Or use the Supabase Dashboard to manually fix the issue


