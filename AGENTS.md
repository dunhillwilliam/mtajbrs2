# AGENTS.md — MTA Jebres 2 Presensi

## Project Overview

A zero-framework web attendance app for MTA Jebres 2, deployed on Cloudflare Pages + Pages Functions with Supabase PostgreSQL. Single admin manages groups, members, and events; attendance recording via public URL (no login needed).

**Language:** 100% JavaScript (ES Modules)
**Hosting:** Cloudflare Pages + Pages Functions
**Database:** Cloudflare D1 (SQLite) via the `DB` binding
**Auth:** Custom JWT via Web Crypto API (HMAC-SHA256)
**Runtime deps:** None (npm deps in package.json are unused)

## Key Architecture

```
Browser → Cloudflare Pages
  ├── public/        → static HTML/CSS/JS (served directly)
  └── functions/     → serverless endpoints (CF Pages Functions)
                          └── D1 database (via env.DB binding)
```

## File Reference

### Backend (`functions/`)

| File | Purpose | Key exports |
|------|---------|-------------|
| `functions/_utils/auth.js` | JWT utilities | `signToken(secret)`, `verifyToken(token, secret)`, `requireAuth(request, env)` |
| `functions/_utils/db.js` | D1 query helper | `getDb(env)` returns object with `.select()`, `.insert()`, `.update()`, `.updateBy()`, `.delete()`, `.upsert()` |
| `functions/api/auth/login.js` | Admin auth | `onRequestPost` — validates credentials against env vars, returns JWT |
| `functions/api/auth/verify.js` | JWT validation | `onRequestGet` — returns 200 if valid JWT |
| `functions/api/batches/index.js` | Batches (gelombang) CRUD | `onRequestGet`, `onRequestPost` |
| `functions/api/batches/[id].js` | Batch by ID | `onRequestPut`, `onRequestDelete` |
| `functions/api/groups/index.js` | Groups CRUD | `onRequestGet` (joins `batches(name)`), `onRequestPost` (accepts `batch_id`) |
| `functions/api/groups/[id].js` | Group by ID | `onRequestPut`, `onRequestDelete` |
| `functions/api/members/index.js` | Members CRUD | `onRequestGet` (supports `?group_id=` filter with join), `onRequestPost` |
| `functions/api/members/[id].js` | Member by ID | `onRequestPut`, `onRequestDelete` |
| `functions/api/events/index.js` | Events CRUD | `onRequestGet` (ordered by date desc), `onRequestPost` (accepts `repeat_type`, `repeat_days`) |
| `functions/api/events/[id].js` | Event by ID | `onRequestPut`, `onRequestDelete` |
| `functions/api/events/[id]/groups.js` | Event-group assignment | `onRequestGet`, `onRequestPost` (accepts `{ group_ids: [...] }`) |
| `functions/api/attendance/[event].js` | Attendance (public) | `onRequestGet` (event info + members grouped + status for an occurrence; `?date=` param, defaults to today WIB), `onRequestPost` (upserts batch attendance for today's occurrence) |
| `functions/api/stats.js` | Statistics | `onRequestGet` (admin-only, returns per-event + per-member stats) |
| `functions/_utils/recurrence.js` | Weekly recurrence helpers | `serverToday()`, `isScheduledOn(event, date)`, `occurrenceDates(event, max)`, `nextScheduledDate(event, after)`, `countOccurrencesUpTo(event, date)`, `parseRepeatDays(event)`, `serializeRepeatDays(type, days)` |

### Frontend (`public/`)

| File | Purpose |
|------|---------|
| `public/index.html` | Redirects to `login.html` |
| `public/login.html` | Admin login form → `API.login()` → stores JWT in localStorage |
| `public/dashboard.html` | Admin dashboard with 4 tab views |
| `public/attendance.html` | Public attendance form (`?event=UUID`) |
| `public/recap.html` | Per-event recap/summary (`?event=UUID`) |
| `public/css/style.css` | Complete responsive CSS (mobile-first, 2 breakpoints at 640px and 400px) |
| `public/js/api.js` | `API` singleton object — fetch wrapper with auto JWT attachment, 401 redirect, typed methods |
| `public/js/admin.js` | Dashboard logic: tab switching, CRUD operations, stats rendering, inline editing, sortable tables |
| `public/js/attendance.js` | Attendance page: loads event data, renders radio button groups (Hadir/Sakit/Izin/Alpha), batch submit |
| `public/js/recap.js` | Recap page: loads event data, renders stat cards + sortable member table |

### Config & Data

| File | Purpose |
|------|---------|
| `schema.sql` | Full D1/SQLite DDL (6 tables with FK constraints, CHECK constraints, UNIQUE tuples) |
| `migrations/` | SQL migrations to upgrade existing databases |
| `seed.sql` | Seed data with 2 batches, 7 groups and ~90 members |
| `wrangler.toml` | Pages config and D1 binding (`DB`) |
| `dev/` | Local dev helpers: `init-local-db.js`, `local-d1.js`, `wrangler.js`, `import-supabase.js` |
| `PLAN.md` | Original project plan and design document |

## Database Schema

6 tables in Cloudflare D1 (SQLite). IDs are `TEXT` UUIDs; dates/times/timestamps are stored as `TEXT`.

**`batches`** — `id TEXT PK`, `name TEXT NOT NULL`, `description TEXT NOT NULL DEFAULT ''`, `created_at TEXT DEFAULT datetime('now')`

**`groups`** — `id TEXT PK`, `name TEXT NOT NULL`, `description TEXT NOT NULL DEFAULT ''`, `batch_id TEXT → batches(id) ON DELETE SET NULL`, `created_at TEXT`

**`members`** — `id TEXT PK`, `nickname TEXT NOT NULL`, `group_id TEXT NOT NULL → groups(id) ON DELETE CASCADE`, `created_at TEXT`

**`events`** — `id TEXT PK`, `name TEXT NOT NULL`, `date TEXT NOT NULL` (reference/start date), `start_time TEXT`, `end_time TEXT`, `location TEXT NOT NULL DEFAULT ''`, `description TEXT NOT NULL DEFAULT ''`, `repeat_type TEXT NOT NULL DEFAULT 'none'` (`none` or `weekly`), `repeat_days TEXT NOT NULL DEFAULT ''` (comma-separated weekday numbers `0=Sun..6=Sat`), `created_at TEXT`. Recurring template; attendance link is stable and reused each occurrence.

**`group_event`** — `id TEXT PK`, `group_id TEXT → groups(id) ON DELETE CASCADE`, `event_id TEXT → events(id) ON DELETE CASCADE`, UNIQUE(group_id, event_id)

**`member_event`** — `id TEXT PK`, `member_id TEXT → members(id) ON DELETE CASCADE`, `event_id TEXT → events(id) ON DELETE CASCADE`, `occurrence_date TEXT NOT NULL`, `status TEXT CHECK (IN 'hadir','sakit','izin','alpha')`, `notes TEXT NOT NULL DEFAULT ''`, UNIQUE(member_id, event_id, occurrence_date)

## API Patterns

### Pages Functions Convention

Each function file exports named exports matching HTTP methods:
```js
export async function onRequestGet(context) { ... }
export async function onRequestPost(context) { ... }
export async function onRequestPut(context) { ... }
export async function onRequestDelete(context) { ... }
```

`context` object: `{ request, env, params, waitUntil }`

### Auth Pattern

Admin endpoints check auth early:
```js
if (!await requireAuth(request, env)) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
}
```

### D1 Client Usage

All endpoints use the same pattern:
```js
const db = getDb(env)
const result = await db.select('table', { filters: { column: value }, order: 'column.asc' })
```

Available methods: `select`, `insert`, `update`, `updateBy`, `delete`, `upsert`. See `functions/_utils/db.js` for full signatures. It builds parameterized SQL and runs it through the D1 binding (`env.DB`). IDs are generated in the app with `crypto.randomUUID()`; timestamps default to SQLite `datetime('now')`.

Join selects (`groups(name)`, `batches(name)`) are supported via a `LEFT JOIN` and are returned as nested objects, matching the previous REST client shape.

### Response Format

Success: `new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })`
Error: `new Response(JSON.stringify({ error: message }), { status: 4xx/5xx, headers: { 'Content-Type': 'application/json' } })`

### Frontend API Client

The `API` singleton in `public/js/api.js` wraps fetch with:
- Auto-attaches `Authorization: Bearer <token>` from localStorage
- Auto-redirects to `login.html` on 401
- Returns parsed JSON or throws with `.error` field

## Data Flows

### Attendance Recording Flow
1. Admin creates event (optionally recurring via `repeat_type=weekly` + `repeat_days`), assigns groups
2. Attendance page fetches `GET /api/attendance/:event` → returns event + all members in their groups + status for **today's occurrence** (`occurrence_date`, default today WIB) + `scheduled` + `in_window` flags
3. If today is a scheduled occurrence and inside the time window, taker marks each member and submits `POST /api/attendance/:event` with `{ attendance: [{ member_id, status, notes }] }`
4. Server upserts into `member_event` (conflict on `member_id, event_id, occurrence_date`). Because attendance is keyed per date, the form naturally "resets" each new occurrence while preserving prior days' data.

### Stats Computation Flow
1. Dashboard fetches `GET /api/stats`
2. Server loads all events, group_event links, members, and member_event records
3. Computes per-event: total expected members (sum of group sizes × occurrences up to today), status counts across all occurrences, hadir rate
4. Computes per-member: total expected events (scheduled occurrences up to today for their group), status counts, hadir rate

## Important Design Decisions

1. **No runtime npm dependencies** — All functionality uses native APIs (Web Crypto, D1 binding). Do not add runtime npm imports. (`express`/`dotenv` are used only by the local `server.js` dev harness.)
2. **Public attendance** — The attendance GET/POST endpoints deliberately skip auth so anyone with the event URL can record attendance.
3. **Batch upsert** — All attendance for an event's occurrence is submitted in one request and upserted by `(member_id, event_id, occurrence_date)`. The unique tuple includes `occurrence_date`, so each occurrence's attendance is stored separately and the form resets between occurrences.
4. **Cascading deletes** — Deleting a group cascade-deletes its members and their attendance records. The DB schema enforces this via `ON DELETE CASCADE`.
5. **Indonesian language** — All UI text uses Indonesian (`kelompok`, `anggota`, `kegiatan`, `hadir`, `sakit`, `izin`, `alpha`). Status labels and their display names should stay in Indonesian.
6. **No build step** — The project has zero build configuration. CF Pages serves `public/` directly and auto-discovers `functions/`.

## Environment Variables

| Env Var | Where Used |
|---------|-----------|
| `ADMIN_USERNAME` | `functions/api/auth/login.js` |
| `ADMIN_PASSWORD` | `functions/api/auth/login.js` |
| `JWT_SECRET` | `functions/_utils/auth.js` (signToken, verifyToken) |

The database is provided by the D1 binding `DB` in `wrangler.toml` — not an env var. Local CLI helpers in `dev/wrangler.js` additionally read `CF_DB_KEY`, `CF_DB_UUID`, and `CF_ACCOUNT_ID` from `.env`.

## Common Tasks

**Adding a new admin-only endpoint:**
1. Create file in `functions/api/<resource>/<action>.js`
2. Import `requireAuth` from `../../_utils/auth` and `getDb` from `../../_utils/db`
3. Export `onRequestGet` / `onRequestPost` etc.
4. Call `requireAuth(request, env)` at the top, return 401 if null

**Adding a new public endpoint:**
Same as above, but skip the auth check.

**Adding a frontend page:**
1. Add `.html` file in `public/`
2. Link `js/api.js` for API access
3. Create a `.js` file in `public/js/` for page logic
4. Link `css/style.css` for styling

**Modifying attendance statuses:**
Status values are `hadir`, `sakit`, `izin`, `alpha`. Changes require:
1. DB CHECK constraint in `schema.sql`
2. Radio button rendering in `public/js/attendance.js`
3. `statusLabel()` mapping in both `attendance.js` and `recap.js`
4. Any display logic referencing these strings

## Testing

No automated tests exist. Manual testing via the frontend is the current approach.
