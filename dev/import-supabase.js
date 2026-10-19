// Import Supabase CSV exports (data/*.csv) into Cloudflare D1.
//
// Usage:
//   node dev/import-supabase.js            # validate + write data/import.sql
//   node dev/import-supabase.js --no-clear # keep existing rows (only insert)
//
// Then apply it with:
//   node dev/wrangler.js d1 execute mta-presensi --remote --file=./data/import.sql
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'data')
const clear = !process.argv.includes('--no-clear')

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let i = 0
  let inQuotes = false
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += c; i++
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

function readTable(file, columns) {
  const text = fs.readFileSync(path.join(dataDir, file), 'utf8')
  const rows = parseCsv(text).filter(r => r.some(x => x !== ''))
  if (rows.length === 0) return []
  const header = rows[0]
  const missing = columns.filter(c => !header.includes(c))
  if (missing.length) throw new Error(`${file}: missing columns ${missing.join(', ')}`)
  return rows.slice(1).map(r => {
    const obj = {}
    for (const c of columns) obj[c] = r[header.indexOf(c)]
    return obj
  })
}

function normalizeTimestamp(value) {
  if (!value) return null
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:[+-]\d{2}(?::?\d{2})?|Z)?$/)
  return match ? `${match[1]} ${match[2]}` : value
}

function quote(value) {
  if (value === null || value === undefined || value === '') return "''"
  return `'${String(value).replace(/'/g, "''")}'`
}

const SCHEMA = {
  batches: ['id', 'name', 'description', 'created_at'],
  groups: ['id', 'name', 'description', 'batch_id', 'created_at'],
  members: ['id', 'nickname', 'group_id', 'created_at'],
  events: ['id', 'name', 'date', 'start_time', 'end_time', 'location', 'description', 'repeat_type', 'repeat_days', 'created_at'],
  group_event: ['id', 'group_id', 'event_id', 'created_at'],
  member_event: ['id', 'member_id', 'event_id', 'occurrence_date', 'status', 'notes', 'created_at', 'updated_at'],
}

const FILES = {
  batches: 'batches_rows.csv',
  groups: 'groups_rows.csv',
  members: 'members_rows.csv',
  events: 'events_rows.csv',
  group_event: 'group_event_rows.csv',
  member_event: 'member_event_rows.csv',
}

const TIMESTAMPS = new Set(['created_at', 'updated_at'])

const data = {}
for (const [table, file] of Object.entries(FILES)) {
  data[table] = readTable(file, SCHEMA[table])
  for (const row of data[table]) {
    for (const key of Object.keys(row)) {
      if (TIMESTAMPS.has(key)) row[key] = normalizeTimestamp(row[key])
      if (row[key] === '') row[key] = null
    }
  }
}

// ---- referential integrity checks ----
const ids = table => new Set(data[table].map(r => r.id))
const batches = ids('batches')
const groups = ids('groups')
const members = ids('members')
const events = ids('events')
const problems = []
const check = (label, rows, column, valid) => {
  for (const row of rows) {
    if (row[column] && !valid.has(row[column])) problems.push(`${label}: ${column}=${row[column]} (row ${row.id})`)
  }
}
check('groups', data.groups, 'batch_id', batches)
check('members', data.members, 'group_id', groups)
check('group_event', data.group_event, 'group_id', groups)
check('group_event', data.group_event, 'event_id', events)
check('member_event', data.member_event, 'member_id', members)
check('member_event', data.member_event, 'event_id', events)
for (const table of Object.keys(data)) {
  const seen = new Set()
  for (const row of data[table]) {
    if (seen.has(row.id)) problems.push(`${table}: duplicate id ${row.id}`)
    seen.add(row.id)
  }
}
for (const row of data.member_event) {
  if (!row.occurrence_date) problems.push(`member_event: missing occurrence_date (row ${row.id})`)
  if (!['hadir', 'sakit', 'izin', 'alpha'].includes(row.status)) problems.push(`member_event: bad status "${row.status}" (row ${row.id})`)
}

console.log('Row counts:', Object.fromEntries(Object.entries(data).map(([t, r]) => [t, r.length])))
if (problems.length) {
  console.error(`\nFound ${problems.length} integrity problem(s):`)
  for (const p of problems.slice(0, 50)) console.error('  -', p)
  if (problems.length > 50) console.error(`  ... and ${problems.length - 50} more`)
  process.exit(1)
}
console.log('Referential integrity: OK')

// ---- generate SQL ----
const INSERT_ORDER = ['batches', 'groups', 'members', 'events', 'group_event', 'member_event']
const DELETE_ORDER = ['member_event', 'group_event', 'members', 'groups', 'events', 'batches']
const ROWS_PER_STATEMENT = 50

const chunks = []
if (clear) {
  for (const table of DELETE_ORDER) chunks.push(`DELETE FROM "${table}";`)
}

for (const table of INSERT_ORDER) {
  const columns = SCHEMA[table]
  const rows = data[table]
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const batch = rows.slice(i, i + ROWS_PER_STATEMENT)
    const values = batch.map(row => `(${columns.map(c => quote(row[c])).join(', ')})`).join(',\n  ')
    chunks.push(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n  ${values};`)
  }
}

const outFile = path.join(dataDir, 'import.sql')
fs.writeFileSync(outFile, chunks.join('\n') + '\n')
console.log(`\nWrote ${outFile} (${chunks.length} statements, ${clear ? 'clears existing rows first' : 'append only'})`)
