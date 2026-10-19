# MTA Jebres 2 — Presensi

> A web-based attendance tracking system for **MTA Jebres 2** (a religious/community organization in Jebres, Indonesia). Built with zero framework overhead — vanilla JavaScript on Cloudflare Pages with Cloudflare D1 (SQLite).

## Features

- **Admin Dashboard** — Full CRUD management for groups (*kelompok*), members (*anggota*), and events (*kegiatan*)
- **Public Attendance Page** — Shareable per-event URL where anyone can mark each member as **Hadir** (Present), **Sakit** (Sick), **Izin** (Permitted absence), or **Alpha** (Unexcused absence)
- **Recap/Summary** — Per-event recap page with aggregate stats and sortable member table
- **Statistics** — Admin dashboard tab showing per-event attendance rates and per-member attendance across all events, with sortable columns and group filtering
- **Admin Auth** — Username/password login with JWT tokens signed via Web Crypto API (HMAC-SHA256)
- **Mobile Responsive** — Fully responsive CSS with collapsible group sections, optimized for mobile attendance-taking
- **Indonesian UI** — All labels and statuses in Indonesian language

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Hosting | Cloudflare Pages + Pages Functions |
| Database | Cloudflare D1 (SQLite, free tier) |
| Auth | JWT (Web Crypto API HMAC-SHA256) |
| Backend | Vanilla JavaScript ES Modules (CF Pages Functions) |
| Frontend | Vanilla HTML + CSS + JavaScript |

Zero runtime dependencies — the codebase uses no npm packages at runtime. All auth is done via the native Web Crypto API, and the database is accessed through the D1 binding (`env.DB`) via a small query helper.

## Project Structure

```
├── functions/                  # Cloudflare Pages Functions (backend API)
│   ├── _utils/
│   │   ├── auth.js             # JWT sign, verify, requireAuth middleware
│   │   ├── db.js               # D1 query helper (select, insert, update, updateBy, delete, upsert)
│   │   └── recurrence.js       # Weekly recurrence helpers
│   └── api/
│       ├── auth/
│       │   ├── login.js        # POST /api/auth/login
│       │   └── verify.js       # GET /api/auth/verify
│       ├── groups/
│       │   ├── index.js        # GET, POST /api/groups
│       │   └── [id].js         # PUT, DELETE /api/groups/:id
│       ├── members/
│       │   ├── index.js        # GET, POST /api/members
│       │   └── [id].js         # PUT, DELETE /api/members/:id
│       ├── events/
│       │   ├── index.js        # GET, POST /api/events
│       │   ├── [id].js         # PUT, DELETE /api/events/:id
│       │   └── [id]/groups.js  # GET, POST /api/events/:id/groups
│       ├── attendance/
│       │   └── [event].js      # GET, POST /api/attendance/:event (public)
│       └── stats.js            # GET /api/stats (admin)
├── migrations/                  # SQL migrations for existing databases
│   └── 2026-09-06-recurring-events.sql
├── public/                     # Static frontend (served by Cloudflare Pages)
│   ├── index.html              # Redirects to login.html
│   ├── login.html              # Admin login page
│   ├── dashboard.html          # Admin dashboard (4 tabs: Kelompok, Anggota, Kegiatan, Statistik)
│   ├── attendance.html         # Public attendance page (?event=UUID)
│   ├── recap.html              # Per-event recap page (?event=UUID)
│   ├── css/
│   │   └── style.css           # Complete responsive stylesheet
│   └── js/
│       ├── api.js              # Fetch wrapper with JWT handling
│       ├── admin.js            # Dashboard CRUD logic + stats
│       ├── attendance.js       # Attendance page logic
│       └── recap.js            # Recap page logic
├── dev/                        # Local development helpers
│   ├── init-local-db.js        # Create local SQLite DB from schema/seed
│   ├── local-d1.js             # node:sqlite adapter exposing the D1 API
│   └── wrangler.js             # Runs wrangler using CF_* vars from .env
├── schema.sql                  # D1/SQLite schema (fresh install)
├── seed.sql                    # Test/seed data
├── wrangler.toml               # Pages config + D1 binding
├── PLAN.md                     # Original implementation plan
└── package.json
```

## Database Schema

Six SQLite tables managed via Cloudflare D1:

| Table | Purpose |
|-------|---------|
| `batches` | Batches/gelombang; groups optionally belong to one |
| `groups` | Member groups (e.g., pa-kelompok1, pemudi) |
| `members` | Individual members (nickname + group FK) |
| `events` | Activities/events with date, time, location, and optional weekly repeat (`repeat_type`, `repeat_days`) |
| `group_event` | Many-to-many: which groups participate in which events |
| `member_event` | Attendance records: one row per member per event occurrence (`member_id`, `event_id`, `occurrence_date`) |

Attendance statuses: `hadir` (present), `sakit` (sick), `izin` (permitted absence), `alpha` (unexcused absence).

See `schema.sql` for the full DDL.

## Setup

### 1. Cloudflare D1 Database

1. Create the database:
   ```bash
   npx wrangler d1 create mta-presensi
   ```
2. Copy the returned `database_id` into `wrangler.toml` under `[[d1_databases]]`.
3. Apply the schema and (optionally) seed data:
   ```bash
   npm run db:schema   # remote
   npm run db:seed     # remote
   ```

For a database created before recurring events, run `npm run db:migrate` instead of `db:schema`.

#### Importing data exported from Supabase

1. Drop the Supabase CSV exports into `data/` (`batches_rows.csv`, `groups_rows.csv`, `members_rows.csv`, `events_rows.csv`, `group_event_rows.csv`, `member_event_rows.csv`).
2. `npm run db:import` validates referential integrity and writes `data/import.sql`.
3. `npm run db:import:remote` regenerates and applies it to the remote D1 (clears existing rows first).

`data/` is gitignored because it contains personal data.

### 2. Environment Variables

`wrangler.toml` binds D1 as `DB`; no database credentials are needed at runtime.
Set the following in your Cloudflare Pages dashboard:

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `JWT_SECRET` | Secret key for HMAC-SHA256 JWT signing (use a long random string) |

For the CLI helpers, `.env` may also define:

| Variable | Description |
|----------|-------------|
| `CF_DB_KEY` | Cloudflare API token with D1 edit permission |
| `CF_DB_UUID` | D1 database ID (written into `wrangler.toml`) |
| `CF_ACCOUNT_ID` | Cloudflare account ID |

### 3. Deploy to Cloudflare Pages

**Via Git (recommended):**

- Push the repo to GitHub
- Connect the repo to Cloudflare Pages
- Build settings: leave blank (no build step needed)
- Set environment variables in the dashboard

**Via Wrangler CLI:**

```bash
npx wrangler pages deploy public --project-name mta-krpd-presensi
```

Set env vars with:

```bash
npx wrangler pages secret put ADMIN_USERNAME
# ... repeat for each variable
```

### 4. Local Development

Option A — Wrangler (uses the real D1 API locally):

```bash
npm run db:schema:local
npm run db:seed:local
npm run dev:cf
```

Option B — Express with a local SQLite file (no Wrangler needed):

```bash
npm install
npm run db:init   # creates .wrangler/local-d1.sqlite from schema + seed
npm run dev       # http://localhost:3000
```

Both serve `public/` statically and run `functions/` as serverless endpoints locally.

## API Reference

### Admin Endpoints (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Authenticate admin, returns JWT |
| GET | `/api/auth/verify` | Verify JWT validity |
| GET | `/api/groups` | List all groups |
| POST | `/api/groups` | Create a group |
| PUT | `/api/groups/:id` | Update a group |
| DELETE | `/api/groups/:id` | Delete group (cascades to members) |
| GET | `/api/members` | List members (optional `?group_id=`) |
| POST | `/api/members` | Create a member |
| PUT | `/api/members/:id` | Update a member |
| DELETE | `/api/members/:id` | Delete a member |
| GET | `/api/events` | List events (ordered by date desc) |
| POST | `/api/events` | Create an event |
| PUT | `/api/events/:id` | Update an event |
| DELETE | `/api/events/:id` | Delete an event |
| GET | `/api/events/:id/groups` | Get groups assigned to event |
| POST | `/api/events/:id/groups` | Assign groups to event |
| GET | `/api/stats` | Compute attendance statistics |

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance/:event` | Get event info + members grouped by group + current attendance |
| POST | `/api/attendance/:event` | Submit batch attendance (upsert) |

## Usage Flow

1. **Admin** logs in at `/login.html` → creates groups, members, and events via the dashboard
2. **Admin** assigns groups to an event → copies the attendance link (e.g., `/attendance.html?event=<UUID>`)
3. **Attendance taker** opens the link → marks each member as Hadir/Sakit/Izin/Alpha → submits
4. **Anyone** views the recap at `/recap.html?event=<UUID>` to see summary stats and member-by-member status
5. **Admin** views per-event and per-member statistics on the dashboard

## Architecture Decisions

- **Attendance endpoints are public** — so multiple people can record attendance without needing admin credentials
- **Batch submission** — attendance is sent as a single upsert array, not individual records
- **Custom Supabase client** — a lightweight fetch-based wrapper avoids the official SDK's ESM/CJS issues in Cloudflare Workers
- **Custom JWT** — uses the native Web Crypto API instead of the `jose` library, keeping the deployable artifact dependency-free
- **No build step** — Cloudflare Pages serves `public/` directly and auto-detects `functions/` as serverless endpoints
