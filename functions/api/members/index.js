import { requireAuth } from '../../_utils/auth.js'
import { getDb } from '../../_utils/db.js'

export async function onRequestGet(context) {
  const { request, env } = context
  if (!await requireAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const db = getDb(env)
    const url = new URL(request.url)
    const groupId = url.searchParams.get('group_id')

    const opts = { order: 'nickname.asc', select: '*,groups(name)' }
    if (groupId) opts.filters = { group_id: groupId }

    const data = await db.select('members', opts)
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  if (!await requireAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const db = getDb(env)
    const body = await request.json()
    const data = await db.insert('members', { nickname: body.nickname, group_id: body.group_id }, { select: '*', single: true })
    return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
