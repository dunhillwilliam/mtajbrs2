// Create the local dev SQLite database and apply schema.sql (+ optional seed).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dbPath = process.env.LOCAL_D1_PATH || path.join(root, '.wrangler', 'local-d1.sqlite')
const withSeed = !process.argv.includes('--no-seed')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON')

const existing = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'batches'").get()
if (existing) {
  console.log(`Database already initialized at ${dbPath}`)
} else {
  db.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'))
  console.log(`Applied schema.sql to ${dbPath}`)

  if (withSeed) {
    db.exec(fs.readFileSync(path.join(root, 'seed.sql'), 'utf8'))
    console.log('Applied seed.sql')
  }
}

db.close()
