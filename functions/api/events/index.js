import { requireAuth } from '../../_utils/auth.js'
import { getDb } from '../../_utils/db.js'
import { serializeRepeatDays } from '../../_utils/recurrence.js'

export async function onRequestGet(context) {
  const { request, env } = context
  if (!await requireAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const db = getDb(env)
    const data = await db.select('events', { order: 'date.desc' })
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
    const repeat = serializeRepeatDays(body.repeat_type || 'none', body.repeat_days)
    const data = await db.insert('events', {
      name: body.name,
      date: body.date,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      location: body.location || '',
      description: body.description || '',
      repeat_type: repeat.repeat_type,
      repeat_days: repeat.repeat_days,
    }, { select: '*', single: true })
    return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
