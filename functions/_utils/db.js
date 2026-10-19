// Cloudflare D1 data access layer.
// Exposes the same method surface the API endpoints relied on previously
// (select/insert/update/updateBy/delete/upsert) so endpoint code stays simple.

const TABLES = {
  batches: ['id', 'name', 'description', 'created_at'],
  groups: ['id', 'name', 'description', 'batch_id', 'created_at'],
  members: ['id', 'nickname', 'group_id', 'created_at'],
  events: ['id', 'name', 'date', 'start_time', 'end_time', 'location', 'description', 'repeat_type', 'repeat_days', 'created_at'],
  group_event: ['id', 'group_id', 'event_id', 'created_at'],
  member_event: ['id', 'member_id', 'event_id', 'occurrence_date', 'status', 'notes', 'created_at', 'updated_at'],
}

// Foreign-key column used when joining a related table (e.g. groups(name) -> group_id).
const JOIN_FK = {
  batches: 'batch_id',
  groups: 'group_id',
}

function assertTable(table) {
  if (!TABLES[table]) throw new Error(`Unknown table: ${table}`)
}

function assertColumn(table, column) {
  if (!TABLES[table].includes(column)) throw new Error(`Unknown column: ${table}.${column}`)
}

function buildWhere(table, filters, params, alias = 't') {
  const clauses = []
  for (const [key, value] of Object.entries(filters || {})) {
    assertColumn(table, key)
    if (Array.isArray(value)) {
      if (value.length === 0) {
        clauses.push('1 = 0')
        continue
      }
      clauses.push(`${alias}."${key}" IN (${value.map(() => '?').join(', ')})`)
      params.push(...value)
    } else {
      clauses.push(`${alias}."${key}" = ?`)
      params.push(value)
    }
  }
  return clauses
}

function shapeJoins(row, joins) {
  const out = { ...row }
  for (const join of joins) {
    const prefix = `${join.joinTable}__`
    const nested = {}
    let hasValue = false
    for (const key of Object.keys(out)) {
      if (key.startsWith(prefix)) {
        nested[key.slice(prefix.length)] = out[key]
        if (out[key] !== null) hasValue = true
        delete out[key]
      }
    }
    out[join.joinTable] = hasValue ? nested : null
  }
  return out
}

function createClient(db) {
  async function all(sql, params = []) {
    const result = await db.prepare(sql).bind(...params).all()
    return result.results || []
  }

  async function run(sql, params = []) {
    return db.prepare(sql).bind(...params).run()
  }

  return {
    async select(table, opts = {}) {
      assertTable(table)
      const params = []
      const selectParts = []
      const joins = []

      const rawSelect = opts.select || '*'
      for (const token of rawSelect.split(',').map(s => s.trim()).filter(Boolean)) {
        const joinMatch = token.match(/^(\w+)\((.+)\)$/)
        if (joinMatch) {
          const joinTable = joinMatch[1]
          const fk = JOIN_FK[joinTable]
          assertTable(joinTable)
          if (!fk) throw new Error(`No join relation for: ${joinTable}`)
          const alias = `j${joins.length}`
          for (const joinColumn of joinMatch[2].split(',').map(s => s.trim())) {
            assertColumn(joinTable, joinColumn)
            selectParts.push(`${alias}."${joinColumn}" AS "${joinTable}__${joinColumn}"`)
          }
          joins.push({ joinTable, fk, alias })
        } else if (token === '*') {
          selectParts.push('t.*')
        } else {
          assertColumn(table, token)
          selectParts.push(`t."${token}"`)
        }
      }

      let sql = `SELECT ${selectParts.join(', ')} FROM "${table}" AS t`
      for (const join of joins) {
        sql += ` LEFT JOIN "${join.joinTable}" AS ${join.alias} ON t."${join.fk}" = ${join.alias}."id"`
      }

      const where = buildWhere(table, opts.filters, params)
      if (where.length) sql += ` WHERE ${where.join(' AND ')}`

      if (opts.order) {
        const [column, direction] = String(opts.order).split('.')
        assertColumn(table, column)
        sql += ` ORDER BY t."${column}" ${String(direction).toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`
      }

      if (opts.limit !== undefined && opts.limit !== null) {
        const limit = Number(opts.limit)
        if (!Number.isInteger(limit) || limit < 0) throw new Error('Invalid limit')
        sql += ` LIMIT ${limit}`
      }

      const rows = await all(sql, params)
      return joins.length ? rows.map(row => shapeJoins(row, joins)) : rows
    },

    async insert(table, records, opts = {}) {
      assertTable(table)
      const list = Array.isArray(records) ? records : [records]
      const inserted = []

      for (const record of list) {
        const row = { ...record }
        if (TABLES[table].includes('id') && !row.id) row.id = crypto.randomUUID()
        const keys = Object.keys(row).filter(key => TABLES[table].includes(key))
        if (keys.length === 0) throw new Error(`No insertable columns for ${table}`)
        const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) RETURNING *`
        const rows = await all(sql, keys.map(key => row[key]))
        inserted.push(rows[0])
      }

      return opts.single ? inserted[0] : inserted
    },

    async update(table, id, data, opts = {}) {
      assertTable(table)
      const keys = Object.keys(data).filter(key => TABLES[table].includes(key))
      if (keys.length === 0) throw new Error(`No updatable columns for ${table}`)
      const sql = `UPDATE "${table}" SET ${keys.map(k => `"${k}" = ?`).join(', ')} WHERE "id" = ? RETURNING *`
      const rows = await all(sql, [...keys.map(key => data[key]), id])
      return opts.single ? (rows[0] ?? null) : rows
    },

    async updateBy(table, filters, data) {
      assertTable(table)
      const setKeys = Object.keys(data).filter(key => TABLES[table].includes(key))
      if (setKeys.length === 0) throw new Error(`No updatable columns for ${table}`)
      const params = []
      const where = buildWhere(table, filters, params)
      const sql = `UPDATE "${table}" AS t SET ${setKeys.map(k => `"${k}" = ?`).join(', ')}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} RETURNING *`
      return all(sql, [...setKeys.map(key => data[key]), ...params])
    },

    async delete(table, id) {
      assertTable(table)
      await run(`DELETE FROM "${table}" WHERE "id" = ?`, [id])
    },

    async upsert(table, records, conflict) {
      assertTable(table)
      const list = Array.isArray(records) ? records : [records]
      const conflictColumns = String(conflict || 'id').split(',').map(s => s.trim()).filter(Boolean)
      conflictColumns.forEach(column => assertColumn(table, column))

      const keySet = new Set()
      for (const record of list) {
        for (const key of Object.keys(record)) {
          if (TABLES[table].includes(key)) keySet.add(key)
        }
      }
      if (TABLES[table].includes('id') && !conflictColumns.includes('id')) keySet.add('id')
      const keys = [...keySet]

      const rows = list.map(record => {
        const row = { ...record }
        if (keySet.has('id') && !row.id) row.id = crypto.randomUUID()
        return row
      })

      const updateKeys = keys.filter(key => !conflictColumns.includes(key) && key !== 'id')
      const updateClause = updateKeys.length
        ? `DO UPDATE SET ${updateKeys.map(k => `"${k}" = excluded."${k}"`).join(', ')}`
        : 'DO NOTHING'
      const conflictClause = `ON CONFLICT(${conflictColumns.map(c => `"${c}"`).join(', ')}) ${updateClause}`

      // D1 caps bound parameters per query, so split large batches into chunks.
      const maxParams = 90
      const rowsPerChunk = Math.max(1, Math.floor(maxParams / keys.length))
      const results = []
      for (let i = 0; i < rows.length; i += rowsPerChunk) {
        const chunk = rows.slice(i, i + rowsPerChunk)
        const placeholders = chunk.map(() => `(${keys.map(() => '?').join(', ')})`).join(', ')
        const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES ${placeholders} ${conflictClause} RETURNING *`
        const params = chunk.flatMap(row => keys.map(key => row[key] ?? null))
        results.push(...await all(sql, params))
      }
      return results
    },
  }
}

export function getDb(env = {}) {
  if (!env || !env.DB) {
    throw new Error('D1 binding "DB" is not configured')
  }
  return createClient(env.DB)
}
