// Minimal D1-compatible adapter over node:sqlite for `node server.js` local dev.
// Cloudflare Pages Functions use the real D1 binding (`env.DB`) in production.
import { DatabaseSync } from 'node:sqlite'

function toPlain(row) {
  return row ? { ...row } : row
}

export function createLocalD1(filename = ':memory:') {
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA foreign_keys = ON')

  return {
    prepare(sql) {
      const statement = db.prepare(sql)

      const bound = (params) => ({
        bind(...args) {
          return bound(args)
        },
        async all() {
          return { results: statement.all(...params).map(toPlain) }
        },
        async first() {
          return toPlain(statement.get(...params) ?? null)
        },
        async run() {
          return statement.run(...params)
        },
      })

      return bound([])
    },

    async exec(sql) {
      db.exec(sql)
    },

    async batch(statements) {
      return statements.map(statement => statement.all())
    },
  }
}
