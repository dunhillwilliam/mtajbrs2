# Attendance App — Full Plan

## Overview

A web-based attendance tracking system deployed on Cloudflare Pages with Supabase as the database. Single admin manages groups, members, and events. Attendance recording is done via a public page (no auth required) so multiple people can record attendance.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Hosting | Cloudflare Pages + Pages Functions (serverless) |
| Database | Supabase PostgreSQL (free tier) |
| Auth | Username/password → JWT (via `jose`) |
| API | Vanilla JS Pages Functions |
| Frontend | Vanilla HTML + CSS + JS |
| Dependencies | `jose`, `@supabase/supabase-js` |

---

## Database Schema (Supabase)

```sql
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE group_event (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, event_id)
);

CREATE TABLE member_event (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'sakit', 'izin', 'alpha')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, event_id)
);
```

### Notes on schema

- `members.group_id` is required (NOT NULL) — every member must belong to a group.
- Deleting a group **cascade-deletes** its members (and their attendance records via member FK cascade).
- `member_event.status` uses Indonesian labels: `hadir`, `sakit`, `izin`, `alpha`.
- `member_event.notes` is an optional text field for additional info.
- `UNIQUE(member_id, event_id)` ensures one record per member per event.

---

## Project Structure

```
/
├── functions/
│   └── api/
│       ├── auth/
│       │   ├── login.js        POST   — authenticate admin, return JWT
│       │   └── verify.js       GET    — verify JWT validity
│       ├── groups/
│       │   ├── index.js        GET    — list all groups
│       │   └── [id].js         POST   — create group
│       │                        PUT    — update group
│       │                        DELETE — delete group (cascades to members)
│       ├── members/
│       │   ├── index.js        GET    — list members (optional ?group_id filter)
│       │   └── [id].js         POST   — create member
│       │                        PUT    — update member
│       │                        DELETE — delete member
│       ├── events/
│       │   ├── index.js        GET    — list events
│       │   ├── [id].js         POST   — create event
│       │                        PUT    — update event
│       │                        DELETE — delete event
│       │   └── [id]/groups.js  POST   — assign groups to event
│       └── attendance/
│           └── [event].js      GET    — get members + current attendance for event (public)
│                               POST   — submit attendance (public, no auth)
├── public/
│   ├── index.html              Redirect to login
│   ├── login.html              Admin login page
│   ├── dashboard.html          Admin dashboard (groups, members, events CRUD)
│   ├── attendance.html         Public attendance page (?event=UUID)
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js              Fetch wrapper with JWT handling
│       ├── admin.js            Dashboard CRUD logic
│       └── attendance.js       Attendance page logic
├── package.json                Dependencies (jose, @supabase/supabase-js)
├── wrangler.toml               CF Pages configuration (optional)
└── PLAN.md                    This file
```

---

## API Routes

### Admin endpoints (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Returns JWT on valid credentials |
| GET | `/api/auth/verify` | Returns 200 if JWT is valid |
| GET | `/api/groups` | List all groups |
| POST | `/api/groups` | Create a group |
| PUT | `/api/groups/:id` | Update a group |
| DELETE | `/api/groups/:id` | Delete group (cascade deletes members) |
| GET | `/api/members` | List members (optional `?group_id=`) |
| POST | `/api/members` | Create a member |
| PUT | `/api/members/:id` | Update a member |
| DELETE | `/api/members/:id` | Delete a member |
| GET | `/api/events` | List all events |
| POST | `/api/events` | Create an event |
| PUT | `/api/events/:id` | Update an event |
| DELETE | `/api/events/:id` | Delete an event |
| POST | `/api/events/:id/groups` | Assign groups to event |

### Public endpoints (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance/:event` | Get event info + members (grouped by group) + current status |
| POST | `/api/attendance/:event` | Submit attendance (batch update) |

---

## Auth Flow

1. Admin visits `/login.html`, enters username + password.
2. Form POSTs to `/api/auth/login` with `{ username, password }`.
3. Server checks against `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars.
4. On success: server signs a JWT (using `jose`) with `JWT_SECRET` env var, returns it.
5. Frontend stores JWT in `localStorage`, sends it as `Authorization: Bearer <token>` on all admin API calls.
6. Each admin Pages Function validates the JWT before processing.
7. Attendance endpoints (`/api/attendance/:event`) have **no auth** — any client with the event ID can submit attendance.

---

## Attendance Flow

1. Admin creates event via dashboard, assigns one or more groups to it.
2. Admin shares the attendance URL: `https://site.pages.dev/attendance.html?event=<UUID>`
3. Attendance page opens → fetches `GET /api/attendance/:event`:
   - Returns event details + list of members grouped by group
   - Each member shows their current status (if already recorded) or defaults to unmarked
4. Attendance taker marks each member: **Hadir / Sakit / Izin / Alpha** + optional notes
5. Submits form → `POST /api/attendance/:event` with array of `{ member_id, status, notes }`
6. Server upserts all `member_event` records

---

## Attendance Statuses

| Status | Label | Description |
|--------|-------|-------------|
| `hadir` | Hadir | Present |
| `sakit` | Sakit | Sick |
| `izin` | Izin | Permitted absence |
| `alpha` | Alpha | Unexcused absence |

---

## Environment Variables (CF Pages dashboard)

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `JWT_SECRET` | Secret key for signing JWTs |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (for server-side admin access) |

---

## Implementation Steps

| # | Task |
|---|------|
| 1 | Initialize project: `package.json`, install deps |
| 2 | Create Supabase project + run schema SQL |
| 3 | Build Pages Functions: auth (login, verify) |
| 4 | Build Pages Functions: groups CRUD |
| 5 | Build Pages Functions: members CRUD |
| 6 | Build Pages Functions: events CRUD + group assignment |
| 7 | Build Pages Functions: attendance (GET + POST, public) |
| 8 | Build frontend: login page |
| 9 | Build frontend: admin dashboard (groups, members, events) |
| 10 | Build frontend: attendance page |
| 11 | Test, deploy to Cloudflare Pages |

---

## Notes

- No build step is required for CF Pages — static files in `public/` are served directly, Functions are auto-detected from `functions/`.
- The attendance endpoint is intentionally public (no JWT) so multiple people can record attendance without needing admin credentials.
- Attendance is submitted as a **batch** — the frontend sends all member statuses at once, and the server upserts them.
