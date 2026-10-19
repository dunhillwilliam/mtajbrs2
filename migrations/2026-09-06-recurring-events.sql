-- Migration: recurring (weekly) events + per-occurrence attendance
-- SQLite / Cloudflare D1 version. Run against an existing database created
-- from the pre-recurrence schema:
--   wrangler d1 execute mta-presensi --remote --file=./migrations/2026-09-06-recurring-events.sql
--
-- SQLite cannot ALTER constraints in place, so member_event is rebuilt to add
-- occurrence_date to its unique key.

CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE groups
  ADD COLUMN batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL;

-- 1. Events: add recurrence fields (default 'none' = single day, backward compatible)
ALTER TABLE events
  ADD COLUMN repeat_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE events
  ADD COLUMN repeat_days TEXT NOT NULL DEFAULT '';

-- 2. Member event: add occurrence_date dimension, backfill, then rebuild the
--    table so occurrence_date is NOT NULL and part of the unique key.
ALTER TABLE member_event
  ADD COLUMN occurrence_date TEXT;

UPDATE member_event
SET occurrence_date = (SELECT date FROM events WHERE events.id = member_event.event_id)
WHERE occurrence_date IS NULL;

CREATE TABLE member_event_new (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'sakit', 'izin', 'alpha')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(member_id, event_id, occurrence_date)
);

INSERT INTO member_event_new (id, member_id, event_id, occurrence_date, status, notes, created_at, updated_at)
SELECT id, member_id, event_id, occurrence_date, status, COALESCE(notes, ''), created_at, updated_at
FROM member_event;

DROP TABLE member_event;
ALTER TABLE member_event_new RENAME TO member_event;

CREATE INDEX idx_members_group_id ON members(group_id);
CREATE INDEX idx_groups_batch_id ON groups(batch_id);
CREATE INDEX idx_group_event_event_id ON group_event(event_id);
CREATE INDEX idx_member_event_event_id ON member_event(event_id);
CREATE INDEX idx_member_event_member_id ON member_event(member_id);
