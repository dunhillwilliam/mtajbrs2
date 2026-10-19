import { requireAuth } from '../_utils/auth.js'
import { getDb } from '../_utils/db.js'
import { serverToday, countOccurrencesUpTo } from '../_utils/recurrence.js'

export async function onRequestGet(context) {
  const { request, env } = context
  if (!await requireAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const db = getDb(env)
    const [events, groupEvents, members, attendance] = await Promise.all([
      db.select('events'),
      db.select('group_event'),
      db.select('members', { select: 'id, nickname, group_id' }),
      db.select('member_event', { select: 'member_id, event_id, occurrence_date, status' }),
    ])

    const today = serverToday()

    // Build group → members lookup
    const membersByGroup = {}
    for (const m of members) {
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = []
      membersByGroup[m.group_id].push(m.id)
    }

    // Build event → group_ids lookup
    const eventGroupIds = {}
    for (const ge of groupEvents) {
      if (!eventGroupIds[ge.event_id]) eventGroupIds[ge.event_id] = []
      eventGroupIds[ge.event_id].push(ge.group_id)
    }

    // Compute event->total_members map (expected entries per occurrence)
    const eventMemberCount = {}
    const eventOccurrences = {}
    for (const e of events) {
      const gids = eventGroupIds[e.id] || []
      let total = 0
      for (const gid of gids) {
        total += (membersByGroup[gid] || []).length
      }
      eventMemberCount[e.id] = total
      eventOccurrences[e.id] = countOccurrencesUpTo(e, today)
    }

    // Count attendance per event (across all occurrences)
    const eventStatusCounts = {}
    for (const a of attendance) {
      if (!eventStatusCounts[a.event_id]) eventStatusCounts[a.event_id] = { hadir: 0, sakit: 0, izin: 0, alpha: 0 }
      eventStatusCounts[a.event_id][a.status]++
    }

    const perEvent = events.map(e => {
      const counts = eventStatusCounts[e.id] || { hadir: 0, sakit: 0, izin: 0, alpha: 0 }
      const perOccurrence = eventMemberCount[e.id] || 0
      const total = perOccurrence * (eventOccurrences[e.id] || 0)
      return {
        id: e.id,
        name: e.name,
        date: e.date,
        repeat_type: e.repeat_type,
        repeat_days: e.repeat_days,
        occurrences: eventOccurrences[e.id] || 0,
        total_members: total,
        hadir: counts.hadir,
        sakit: counts.sakit,
        izin: counts.izin,
        alpha: counts.alpha,
        hadir_rate: total > 0 ? Math.round((counts.hadir / total) * 100) : 0,
      }
    })

    // Count events per member (via their group): occurrences up to today
    const memberEventCount = {}
    for (const m of members) {
      let count = 0
      for (const e of events) {
        const gids = eventGroupIds[e.id] || []
        if (gids.includes(m.group_id)) {
          count += eventOccurrences[e.id] || 0
        }
      }
      memberEventCount[m.id] = count
    }

    // Count attendance per member
    const memberStatusCounts = {}
    for (const a of attendance) {
      if (!memberStatusCounts[a.member_id]) memberStatusCounts[a.member_id] = { hadir: 0, sakit: 0, izin: 0, alpha: 0 }
      memberStatusCounts[a.member_id][a.status]++
    }

    // Build group name + batch lookup
    const groups = await db.select('groups', { select: 'id, name, batch_id' })
    const groupNames = {}
    const groupBatchIds = {}
    for (const g of groups) {
      groupNames[g.id] = g.name
      if (g.batch_id) groupBatchIds[g.id] = g.batch_id
    }
    const batches = await db.select('batches', { select: 'id, name' })
    const batchNames = {}
    for (const b of batches) batchNames[b.id] = b.name

    const perMember = members.map(m => {
      const counts = memberStatusCounts[m.id] || { hadir: 0, sakit: 0, izin: 0, alpha: 0 }
      const total = memberEventCount[m.id] || 0
      const batchId = groupBatchIds[m.group_id]
      return {
        id: m.id,
        nickname: m.nickname,
        group: groupNames[m.group_id] || '',
        batch: batchNames[batchId] || 'Tanpa Gelombang',
        total_events: total,
        hadir: counts.hadir,
        sakit: counts.sakit,
        izin: counts.izin,
        alpha: counts.alpha,
        hadir_rate: total > 0 ? Math.round((counts.hadir / total) * 100) : 0,
      }
    })

    return new Response(JSON.stringify({ events: perEvent, members: perMember }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
