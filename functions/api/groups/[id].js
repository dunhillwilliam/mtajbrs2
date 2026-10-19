import { requireAuth } from '../../_utils/auth.js'
import { getDb } from '../../_utils/db.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  if (!await requireAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const db = getDb(env)
    const body = await request.json()
    const updates = { name: body.name, description: body.description }
    if (body.batch_id !== undefined) updates.batch_id = body.batch_id || null
    const data = await db.update('groups', params.id, updates, { select: '*', single: true })
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context
  if (!await requireAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const db = getDb(env)
    await db.delete('groups', params.id)
    return new Response(null, { status: 204 })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
