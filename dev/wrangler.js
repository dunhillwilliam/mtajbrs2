// Run wrangler with credentials from .env (CF_DB_KEY as the API token).
// Dependency-free .env parser so this works before `npm install`.
import { spawn } from 'node:child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function readEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[match[1]] = value
  }
  return out
}

const env = { ...process.env, ...readEnv(path.join(root, '.env')) }

if (env.CF_DB_KEY && !env.CLOUDFLARE_API_TOKEN) {
  env.CLOUDFLARE_API_TOKEN = env.CF_DB_KEY
}
if (env.CF_ACCOUNT_ID && !env.CLOUDFLARE_ACCOUNT_ID) {
  env.CLOUDFLARE_ACCOUNT_ID = env.CF_ACCOUNT_ID
}

const args = process.argv.slice(2)
const localWrangler = path.join(root, 'node_modules', '.bin', 'wrangler')
const hasLocalWrangler = fs.existsSync(localWrangler)
const command = hasLocalWrangler ? localWrangler : 'npx'
const commandArgs = hasLocalWrangler ? args : ['--yes', 'wrangler', ...args]

const child = spawn(command, commandArgs, { stdio: 'inherit', env })
child.on('exit', code => process.exit(code ?? 0))
