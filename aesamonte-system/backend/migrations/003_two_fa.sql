-- Migration 003: Add two_fa_enabled column to employee table
ALTER TABLE employee ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT FALSE;
