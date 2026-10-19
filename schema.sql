-- Cloudflare D1 (SQLite) schema for MTA Jebres 2 Presensi
-- Foreign keys are enforced by D1 by default, so ON DELETE CASCADE/SET NULL work.
-- Apply with:
--   wrangler d1 execute mta-presensi --remote --file=./schema.sql
--   wrangler d1 execute mta-presensi --local  --file=./schema.sql

CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT DEFAULT NULL,
  end_time TEXT DEFAULT NULL,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  repeat_type TEXT NOT NULL DEFAULT 'none',
  repeat_days TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE group_event (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, event_id)
);

CREATE TABLE member_event (
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

CREATE INDEX idx_members_group_id ON members(group_id);
CREATE INDEX idx_groups_batch_id ON groups(batch_id);
CREATE INDEX idx_group_event_event_id ON group_event(event_id);
CREATE INDEX idx_member_event_event_id ON member_event(event_id);
CREATE INDEX idx_member_event_member_id ON member_event(member_id);
