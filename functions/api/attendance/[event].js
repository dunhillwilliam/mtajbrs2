import { getDb } from '../../_utils/db.js'
import { serverToday, isScheduledOn } from '../../_utils/recurrence.js'

const TZ_OFFSET_MS = 25200000

export async function onRequestGet(context) {
  const { env, params, request } = context
  const db = getDb(env)

  try {
    const events = await db.select('events', {
      select: '*',
      filters: { id: params.event },
      limit: 1,
    })
    if (events.length === 0) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }
    const event = events[0]

    const url = new URL(request.url)
    const occurrenceDate = url.searchParams.get('date') || serverToday()
    const scheduled = isScheduledOn(event, occurrenceDate)
    const inWindow = scheduled ? isInTimeWindow(event, occurrenceDate) : false

    const groupLinks = await db.select('group_event', {
      select: 'group_id',
      filters: { event_id: params.event },
    })

    if (groupLinks.length === 0) {
      return new Response(JSON.stringify({ event, groups: [], occurrence_date: occurrenceDate, scheduled, in_window: inWindow }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const groupIds = groupLinks.map(g => g.group_id)

    const groups = await db.select('groups', {
      select: 'id, name',
      filters: { id: groupIds },
      order: 'name.asc',
    })

    const members = await db.select('members', {
      select: 'id, nickname, group_id',
      filters: { group_id: groupIds },
      order: 'nickname.asc',
    })

    const existingAttendance = await db.select('member_event', {
      select: 'member_id, status, notes',
      filters: { event_id: params.event, occurrence_date: occurrenceDate },
    })

    const attendanceMap = {}
    for (const a of existingAttendance) {
      attendanceMap[a.member_id] = { status: a.status, notes: a.notes }
    }

    const groupedMembers = groups.map(group => ({
      ...group,
      members: members
        .filter(m => m.group_id === group.id)
        .map(m => ({
          id: m.id,
          nickname: m.nickname,
          ...(attendanceMap[m.id] || { status: null, notes: '' }),
        })),
    }))

    return new Response(JSON.stringify({ event, groups: groupedMembers, occurrence_date: occurrenceDate, scheduled, in_window: inWindow }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function onRequestPost(context) {
  const { request, env, params } = context
  const db = getDb(env)

  try {
    const events = await db.select('events', {
      select: '*',
      filters: { id: params.event },
      limit: 1,
    })
    if (events.length === 0) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }
    const event = events[0]

    const occurrenceDate = serverToday()

    if (!isScheduledOn(event, occurrenceDate)) {
      return new Response(JSON.stringify({ error: 'Kegiatan tidak dijadwalkan hari ini' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    if (event.start_time) {
      const now = Date.now()
      const [y, m, d] = occurrenceDate.split('-').map(Number)
      const [sh, sm] = event.start_time.split(':').map(Number)
      const start = new Date(Date.UTC(y, m - 1, d, sh, sm)) - TZ_OFFSET_MS
      const end = event.end_time
        ? (() => { const [eh, em] = event.end_time.split(':'); return new Date(Date.UTC(y, m - 1, d, +eh, +em)) - TZ_OFFSET_MS })()
        : new Date(Date.UTC(y, m - 1, d, 23, 59) - TZ_OFFSET_MS)
      if (now < start || now > end) {
        return new Response(JSON.stringify({ error: 'Di luar waktu pengisian kehadiran' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      }
    }

    const body = await request.json()
    const records = body.attendance

    if (!Array.isArray(records)) {
      return new Response(JSON.stringify({ error: 'attendance must be an array' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const prepared = records.map(r => ({
      member_id: r.member_id,
      event_id: params.event,
      occurrence_date: occurrenceDate,
      status: r.status,
      notes: r.notes || '',
      updated_at: new Date().toISOString(),
    }))

    const results = await db.upsert('member_event', prepared, 'member_id,event_id,occurrence_date')
    return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

function isInTimeWindow(event, dateStr) {
  if (!event.start_time) return true
  const now = Date.now()
  const [y, m, d] = dateStr.split('-').map(Number)
  const [sh, sm] = event.start_time.split(':').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d, sh, sm)) - TZ_OFFSET_MS
  const end = event.end_time
    ? (() => { const [eh, em] = event.end_time.split(':'); return new Date(Date.UTC(y, m - 1, d, +eh, +em)) - TZ_OFFSET_MS })()
    : new Date(Date.UTC(y, m - 1, d, 23, 59) - TZ_OFFSET_MS)
  return now >= start && now <= end
}
