/* eslint-disable @typescript-eslint/no-explicit-any */
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise'
import { randomUUID } from 'crypto'

// =====================================================================
// Lapisan kompatibilitas: meniru subset API @supabase/supabase-js
// (from().select().eq()....) tetapi memakai MySQL lokal via mysql2.
// Tujuannya agar kode API route yang sudah ada tidak perlu ditulis ulang.
// =====================================================================

const IDENT = /^[A-Za-z0-9_]+$/

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Nama kolom/tabel tidak valid: ${name}`)
  return `\`${name}\``
}

function getPool(): Pool {
  const g = globalThis as unknown as { __encoretixMysqlPool?: Pool }
  if (g.__encoretixMysqlPool) return g.__encoretixMysqlPool
  g.__encoretixMysqlPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'encoretix',
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',
    decimalNumbers: true,
    dateStrings: ['DATE'],
    charset: 'utf8mb4',
  })

  // Samakan timezone sesi MySQL dengan klien (UTC). Tanpa ini, kolom DATETIME
  // ber-default CURRENT_TIMESTAMP tersimpan sebagai jam dinding server (WIB)
  // tetapi dibaca mysql2 sebagai UTC, sehingga jam tampil meleset +7 jam.
  // mysql2 tidak menyetel time_zone server sendiri, jadi lakukan per koneksi.
  g.__encoretixMysqlPool.on('connection', (conn) => {
    void conn.query("SET time_zone = '+00:00'")
  })

  return g.__encoretixMysqlPool
}

// ---------- Metadata tabel ----------

interface ColumnMeta {
  name: string
  dataType: string
  columnType: string
  nullable: boolean
  defaultValue: unknown
  key: string
  extra: string
}

interface TableMeta {
  columns: Map<string, ColumnMeta>
  primaryKeys: string[]
  uniques: string[]
}

interface Relation {
  target: string
  mode: 'forward' | 'reverse'
  column: string
  refColumn: string
}

const metaCache = new Map<string, Promise<TableMeta>>()
const relationCache = new Map<string, Promise<Map<string, Relation>>>()

async function loadTableMeta(table: string): Promise<TableMeta> {
  const [cols] = await getPool().query<RowDataPacket[]>(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table]
  )
  const columns = new Map<string, ColumnMeta>()
  for (const c of cols) {
    columns.set(c.COLUMN_NAME, {
      name: c.COLUMN_NAME,
      dataType: String(c.DATA_TYPE).toLowerCase(),
      columnType: String(c.COLUMN_TYPE),
      nullable: c.IS_NULLABLE === 'YES',
      defaultValue: c.COLUMN_DEFAULT,
      key: c.COLUMN_KEY,
      extra: c.EXTRA,
    })
  }
  if (columns.size === 0) throw new Error(`Tabel "${table}" tidak ditemukan di database MySQL.`)
  return {
    columns,
    primaryKeys: [...columns.values()].filter((c) => c.key === 'PRI').map((c) => c.name),
    uniques: [...columns.values()].filter((c) => c.key === 'UNI').map((c) => c.name),
  }
}

function getTableMeta(table: string): Promise<TableMeta> {
  if (!metaCache.has(table)) metaCache.set(table, loadTableMeta(table))
  return metaCache.get(table)!
}

async function loadRelations(base: string): Promise<Map<string, Relation>> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME IS NOT NULL
       AND (TABLE_NAME = ? OR REFERENCED_TABLE_NAME = ?)`,
    [base, base]
  )
  const map = new Map<string, Relation>()
  for (const r of rows) {
    if (r.TABLE_NAME === base) {
      map.set(r.REFERENCED_TABLE_NAME, {
        target: r.REFERENCED_TABLE_NAME,
        mode: 'forward',
        column: r.COLUMN_NAME,
        refColumn: r.REFERENCED_COLUMN_NAME,
      })
    }
  }
  for (const r of rows) {
    if (r.REFERENCED_TABLE_NAME === base && r.TABLE_NAME !== base && !map.has(r.TABLE_NAME)) {
      map.set(r.TABLE_NAME, {
        target: r.TABLE_NAME,
        mode: 'reverse',
        column: r.COLUMN_NAME,
        refColumn: r.REFERENCED_COLUMN_NAME,
      })
    }
  }
  return map
}

function getRelations(base: string): Promise<Map<string, Relation>> {
  if (!relationCache.has(base)) relationCache.set(base, loadRelations(base))
  return relationCache.get(base)!
}

// ---------- Konversi nilai ----------

function toSqlDateTime(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString().slice(0, 23).replace('T', ' ')
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 23).replace('T', ' ')
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)) return value
  }
  return value
}

function toSqlDate(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.slice(0, 10)
  return value
}

function convertWrite(col: ColumnMeta, value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  if (col.dataType === 'json') return JSON.stringify(value)
  if (col.dataType === 'datetime' || col.dataType === 'timestamp') return toSqlDateTime(value)
  if (col.dataType === 'date') return toSqlDate(value)
  return value
}

// ---------- Parsing select ----------

interface SelectSpec {
  all: boolean
  columns: string[]
  relations: { name: string; spec: SelectSpec }[]
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of input) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function parseSelect(input: string | undefined): SelectSpec {
  if (!input || !input.trim()) return { all: true, columns: [], relations: [] }
  const spec: SelectSpec = { all: false, columns: [], relations: [] }
  for (const token of splitTopLevel(input)) {
    const rel = /^([A-Za-z0-9_]+)\(([\s\S]*)\)$/.exec(token)
    if (rel) {
      spec.relations.push({ name: rel[1], spec: parseSelect(rel[2]) })
      continue
    }
    if (token === '*') {
      spec.all = true
      continue
    }
    spec.columns.push(token.replace(/"/g, ''))
  }
  return spec
}

function projectRow(row: Record<string, any>, spec: SelectSpec): Record<string, any> {
  if (spec.all) return { ...row }
  const out: Record<string, any> = {}
  for (const c of spec.columns) if (c in row) out[c] = row[c]
  return out
}

async function embedRows(
  base: string,
  rows: Record<string, any>[],
  spec: SelectSpec
): Promise<Record<string, any>[]> {
  if (spec.relations.length === 0 || rows.length === 0) {
    return rows.map((r) => projectRow(r, spec))
  }
  const relations = await getRelations(base)
  const enriched = rows.map((r) => ({ ...r }))

  for (const rel of spec.relations) {
    const info = relations.get(rel.name)
    if (!info) continue

    if (info.mode === 'forward') {
      const keys = [...new Set(enriched.map((r) => r[info.column]).filter((v) => v !== null && v !== undefined))]
      let relatedByKey = new Map<unknown, Record<string, any>>()
      if (keys.length > 0) {
        const [related] = await getPool().query<RowDataPacket[]>(
          `SELECT * FROM ${ident(info.target)} WHERE ${ident(info.refColumn)} IN (?)`,
          [keys]
        )
        relatedByKey = new Map(related.map((r) => [r[info.refColumn], r as Record<string, any>]))
      }
      for (const row of enriched) {
        const hit = relatedByKey.get(row[info.column])
        row[rel.name] = hit ? projectRow(hit, rel.spec) : null
      }
    } else {
      const keys = [...new Set(enriched.map((r) => r[info.refColumn]).filter((v) => v !== null && v !== undefined))]
      const relatedByKey = new Map<unknown, Record<string, any>>()
      if (keys.length > 0) {
        const [related] = await getPool().query<RowDataPacket[]>(
          `SELECT * FROM ${ident(info.target)} WHERE ${ident(info.column)} IN (?)`,
          [keys]
        )
        for (const r of related) {
          if (!relatedByKey.has(r[info.column])) relatedByKey.set(r[info.column], r as Record<string, any>)
        }
      }
      for (const row of enriched) {
        const hit = relatedByKey.get(row[info.refColumn])
        row[rel.name] = hit ? projectRow(hit, rel.spec) : null
      }
    }
  }

  return enriched.map((row) => {
    if (spec.all) {
      const out: Record<string, any> = {}
      for (const [k, v] of Object.entries(row)) out[k] = v
      return out
    }
    const out: Record<string, any> = {}
    for (const c of spec.columns) if (c in row) out[c] = row[c]
    for (const rel of spec.relations) if (rel.name in row) out[rel.name] = row[rel.name]
    return out
  })
}

// ---------- Filter / order ----------

interface Filter {
  sql: string
  params: unknown[]
}

function normalizeArrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value]
}

function buildEq(col: string, value: unknown, negate = false): Filter {
  if (value === null || value === undefined) {
    return { sql: `${ident(col)} IS ${negate ? 'NOT ' : ''}NULL`, params: [] }
  }
  return { sql: `${ident(col)} ${negate ? '<>' : '='} ?`, params: [value] }
}

function buildIn(col: string, values: unknown, negate = false): Filter {
  const arr = normalizeArrayValue(values)
  if (arr.length === 0) return { sql: negate ? '1 = 1' : '1 = 0', params: [] }
  return { sql: `${ident(col)} ${negate ? 'NOT IN' : 'IN'} (?)`, params: [arr] }
}

function buildFilter(op: string, col: string, value: unknown): Filter {
  switch (op) {
    case 'eq':
      return buildEq(col, value)
    case 'neq':
      return buildEq(col, value, true)
    case 'in':
      return buildIn(col, value)
    case 'is':
      if (value === null || value === undefined) return { sql: `${ident(col)} IS NULL`, params: [] }
      return { sql: `${ident(col)} = ?`, params: [value === true ? 1 : value === false ? 0 : value] }
    case 'gt':
      return { sql: `${ident(col)} > ?`, params: [value] }
    case 'gte':
      return { sql: `${ident(col)} >= ?`, params: [value] }
    case 'lt':
      return { sql: `${ident(col)} < ?`, params: [value] }
    case 'lte':
      return { sql: `${ident(col)} <= ?`, params: [value] }
    case 'like':
      return { sql: `${ident(col)} LIKE ?`, params: [value] }
    case 'ilike':
      return { sql: `LOWER(${ident(col)}) LIKE LOWER(?)`, params: [value] }
    default:
      throw new Error(`Operator filter tidak didukung: ${op}`)
  }
}

function parseOrClause(clause: string): Filter {
  const conditions = splitTopLevel(clause).map((part) => {
    const m = /^([A-Za-z0-9_]+)\.([a-z]+)\.([\s\S]*)$/.exec(part)
    if (!m) throw new Error(`Format .or() tidak valid: ${part}`)
    let value: unknown = m[3]
    if (m[2] === 'is' && value === 'null') value = null
    return buildFilter(m[2], m[1], value)
  })
  return {
    sql: `(${conditions.map((c) => c.sql).join(' OR ')})`,
    params: conditions.flatMap((c) => c.params),
  }
}

interface OrderTerm {
  column: string
  ascending: boolean
  nullsFirst?: boolean
}

// ---------- Query builder ----------

interface QueryState {
  mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  selectSpec: SelectSpec
  returning: boolean
  payload: any
  upsertOptions?: { onConflict?: string }
  filters: Filter[]
  orders: OrderTerm[]
  limit?: number
  offset?: number
  single?: 'single' | 'maybe'
}

export class MysqlQuery implements PromiseLike<{ data: any; error: any }> {
  private state: QueryState

  constructor(private table: string) {
    this.state = {
      mode: 'select',
      selectSpec: parseSelect('*'),
      returning: false,
      payload: null,
      filters: [],
      orders: [],
    }
  }

  select(columns?: string): this {
    if (this.state.mode === 'select') {
      this.state.selectSpec = parseSelect(columns)
    } else {
      this.state.returning = true
      this.state.selectSpec = parseSelect(columns)
    }
    return this
  }

  insert(values: any): this {
    this.state.mode = 'insert'
    this.state.payload = values
    return this
  }

  upsert(values: any, options?: { onConflict?: string }): this {
    this.state.mode = 'upsert'
    this.state.payload = values
    this.state.upsertOptions = options
    return this
  }

  update(values: any): this {
    this.state.mode = 'update'
    this.state.payload = values
    return this
  }

  delete(): this {
    this.state.mode = 'delete'
    return this
  }

  eq(column: string, value: unknown): this {
    this.state.filters.push(buildEq(column, value))
    return this
  }

  neq(column: string, value: unknown): this {
    this.state.filters.push(buildEq(column, value, true))
    return this
  }

  in(column: string, values: unknown[]): this {
    this.state.filters.push(buildIn(column, values))
    return this
  }

  is(column: string, value: unknown): this {
    this.state.filters.push(buildFilter('is', column, value))
    return this
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator === 'is') {
      if (value === null || value === undefined) {
        this.state.filters.push({ sql: `${ident(column)} IS NOT NULL`, params: [] })
        return this
      }
      this.state.filters.push({ sql: `${ident(column)} <> ?`, params: [value] })
      return this
    }
    if (operator === 'in') {
      this.state.filters.push(buildIn(column, value, true))
      return this
    }
    this.state.filters.push(buildFilter(operator, column, value))
    return this
  }

  or(clause: string): this {
    this.state.filters.push(parseOrClause(clause))
    return this
  }

  gt(column: string, value: unknown): this {
    this.state.filters.push(buildFilter('gt', column, value))
    return this
  }

  gte(column: string, value: unknown): this {
    this.state.filters.push(buildFilter('gte', column, value))
    return this
  }

  lt(column: string, value: unknown): this {
    this.state.filters.push(buildFilter('lt', column, value))
    return this
  }

  lte(column: string, value: unknown): this {
    this.state.filters.push(buildFilter('lte', column, value))
    return this
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.state.orders.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    })
    return this
  }

  limit(count: number): this {
    this.state.limit = count
    return this
  }

  range(from: number, to: number): this {
    this.state.offset = from
    this.state.limit = to - from + 1
    return this
  }

  single(): this {
    this.state.single = 'single'
    return this
  }

  maybeSingle(): this {
    this.state.single = 'maybe'
    return this
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<{ data: any; error: any } | TResult> {
    return this.execute().catch(onrejected)
  }

  private whereSql(filters: Filter[] = this.state.filters): { sql: string; params: unknown[] } {
    if (filters.length === 0) return { sql: '', params: [] }
    return {
      sql: ` WHERE ${filters.map((f) => f.sql).join(' AND ')}`,
      params: filters.flatMap((f) => f.params),
    }
  }

  private orderSql(): string {
    if (this.state.orders.length === 0) return ''
    const parts = this.state.orders.map((o) => {
      const dir = o.ascending ? 'ASC' : 'DESC'
      if (o.nullsFirst === undefined) return `${ident(o.column)} ${dir}`
      return `(${ident(o.column)} IS NULL) ${o.nullsFirst ? 'DESC' : 'ASC'}, ${ident(o.column)} ${dir}`
    })
    return ` ORDER BY ${parts.join(', ')}`
  }

  private limitSql(): string {
    let sql = ''
    if (this.state.limit !== undefined) sql += ` LIMIT ${Math.max(0, Math.trunc(this.state.limit))}`
    if (this.state.offset !== undefined) sql += ` OFFSET ${Math.max(0, Math.trunc(this.state.offset))}`
    return sql
  }

  private async prepareValues(
    meta: TableMeta,
    obj: Record<string, unknown>,
    generateId: boolean
  ): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue
      const col = meta.columns.get(key)
      if (!col) continue
      out[key] = convertWrite(col, value)
    }
    if (generateId && meta.columns.has('id') && out.id === undefined) {
      if (this.table === 'event_info') {
        const [rows] = await getPool().query<RowDataPacket[]>(
          `SELECT COALESCE(MAX(CAST(id AS UNSIGNED)), 0) + 1 AS next_id
           FROM ${ident('event_info')} WHERE id REGEXP '^[0-9]+$'`
        )
        out.id = String(rows[0]?.next_id ?? 1)
      } else {
        out.id = randomUUID()
      }
    }
    return out
  }

  private async selectRows(
    conn: Pool | PoolConnection,
    filters: Filter[],
    spec: SelectSpec,
    orderSql = '',
    limitSql = ''
  ): Promise<Record<string, any>[]> {
    const where = this.whereSql(filters)
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM ${ident(this.table)}${where.sql}${orderSql}${limitSql}`,
      where.params
    )
    return embedRows(this.table, rows as Record<string, any>[], spec)
  }

  private async runSelect(): Promise<Record<string, any>[]> {
    return this.selectRows(getPool(), this.state.filters, this.state.selectSpec, this.orderSql(), this.limitSql())
  }

  private async runInsert(): Promise<Record<string, any>[]> {
    const meta = await getTableMeta(this.table)
    const input = Array.isArray(this.state.payload) ? this.state.payload : [this.state.payload]
    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()
      const ids: unknown[] = []
      for (const row of input) {
        const data = await this.prepareValues(meta, row ?? {}, true)
        const keys = Object.keys(data)
        if (keys.length === 0) throw new Error('Tidak ada data untuk di-insert')
        const sql = `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
        await conn.query(sql, keys.map((k) => data[k]))
        ids.push(data.id)
      }
      let result: Record<string, any>[] = []
      if (this.state.returning) {
        result = await this.selectByIds(conn, ids, this.state.selectSpec)
      }
      await conn.commit()
      return result
    } catch (err) {
      await conn.rollback().catch(() => {})
      throw err
    } finally {
      conn.release()
    }
  }

  private async selectByIds(
    conn: Pool | PoolConnection,
    ids: unknown[],
    spec: SelectSpec
  ): Promise<Record<string, any>[]> {
    if (ids.length === 0) return []
    const rows = await this.selectRows(conn, [{ sql: `${ident('id')} IN (?)`, params: [ids] }], spec)
    const order = new Map(ids.map((id, i) => [String(id), i]))
    rows.sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0))
    return rows
  }

  private async runUpdate(): Promise<Record<string, any>[]> {
    const meta = await getTableMeta(this.table)
    const data = await this.prepareValues(meta, this.state.payload ?? {}, false)
    const keys = Object.keys(data)
    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()
      let matchedIds: unknown[] = []
      if (this.state.returning) {
        const pre = await this.selectRows(
          conn,
          this.state.filters,
          { all: true, columns: [], relations: [] },
          this.orderSql(),
          this.limitSql()
        )
        matchedIds = pre.map((r) => r.id)
      }
      if (keys.length > 0) {
        const where = this.whereSql()
        const sql = `UPDATE ${ident(this.table)} SET ${keys.map((k) => `${ident(k)} = ?`).join(', ')}${where.sql}${this.limitSql()}`
        await conn.query(sql, [...keys.map((k) => data[k]), ...where.params])
      }
      let result: Record<string, any>[] = []
      if (this.state.returning) {
        result = await this.selectByIds(conn, matchedIds, this.state.selectSpec)
      }
      await conn.commit()
      return result
    } catch (err) {
      await conn.rollback().catch(() => {})
      throw err
    } finally {
      conn.release()
    }
  }

  private async runUpsert(): Promise<Record<string, any>[]> {
    const meta = await getTableMeta(this.table)
    const input = Array.isArray(this.state.payload) ? this.state.payload : [this.state.payload]
    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()
      const prepared: Record<string, unknown>[] = []
      for (const row of input) {
        const data = await this.prepareValues(meta, row ?? {}, true)
        const keys = Object.keys(data)
        if (keys.length === 0) throw new Error('Tidak ada data untuk di-upsert')
        const updateKeys = keys.filter((k) => !meta.primaryKeys.includes(k))
        const updateSql = updateKeys.length > 0
          ? updateKeys.map((k) => `${ident(k)} = VALUES(${ident(k)})`).join(', ')
          : `${ident(meta.primaryKeys[0] ?? 'id')} = ${ident(meta.primaryKeys[0] ?? 'id')}`
        const sql = `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${updateSql}`
        await conn.query(sql, keys.map((k) => data[k]))
        prepared.push(data)
      }

      let result: Record<string, any>[] = []
      if (this.state.returning) {
        const conditions: Filter[] = []
        for (const data of prepared) {
          const parts: Filter[] = []
          const uniqueKeys = [...meta.primaryKeys, ...meta.uniques]
          for (const key of uniqueKeys) {
            if (data[key] !== undefined) {
              parts.push({ sql: `${ident(key)} = ?`, params: [data[key]] })
            }
          }
          if (this.state.upsertOptions?.onConflict && data[this.state.upsertOptions.onConflict] !== undefined) {
            parts.unshift({
              sql: `${ident(this.state.upsertOptions.onConflict)} = ?`,
              params: [data[this.state.upsertOptions.onConflict]],
            })
          }
          if (parts.length > 0) {
            conditions.push({ sql: `(${parts.map((p) => p.sql).join(' OR ')})`, params: parts.flatMap((p) => p.params) })
          }
        }
        if (conditions.length > 0) {
          result = await this.selectRows(
            conn,
            [{ sql: conditions.map((c) => c.sql).join(' OR '), params: conditions.flatMap((c) => c.params) }],
            this.state.selectSpec
          )
        }
      }
      await conn.commit()
      return result
    } catch (err) {
      await conn.rollback().catch(() => {})
      throw err
    } finally {
      conn.release()
    }
  }

  private async runDelete(): Promise<Record<string, any>[]> {
    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()
      let result: Record<string, any>[] = []
      if (this.state.returning) {
        result = await this.selectRows(conn, this.state.filters, this.state.selectSpec)
      }
      const where = this.whereSql()
      await conn.query(`DELETE FROM ${ident(this.table)}${where.sql}`, where.params)
      await conn.commit()
      return result
    } catch (err) {
      await conn.rollback().catch(() => {})
      throw err
    } finally {
      conn.release()
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      let rows: Record<string, any>[] = []
      if (this.state.mode === 'select') rows = await this.runSelect()
      else if (this.state.mode === 'insert') rows = await this.runInsert()
      else if (this.state.mode === 'upsert') rows = await this.runUpsert()
      else if (this.state.mode === 'update') rows = await this.runUpdate()
      else if (this.state.mode === 'delete') rows = await this.runDelete()

      if (this.state.single) {
        if (rows.length === 0) {
          if (this.state.single === 'maybe') return { data: null, error: null }
          return { data: null, error: { message: 'Data tidak ditemukan', code: 'PGRST116' } }
        }
        if (rows.length > 1) {
          return { data: null, error: { message: 'Lebih dari satu baris dikembalikan', code: 'PGRST116' } }
        }
        return { data: rows[0], error: null }
      }

      if (this.state.mode === 'select') return { data: rows, error: null }
      return { data: this.state.returning ? rows : null, error: null }
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err), code: 'MYSQL' } }
    }
  }
}

export class MysqlClient {
  from(table: string): MysqlQuery {
    if (!IDENT.test(table)) throw new Error(`Nama tabel tidak valid: ${table}`)
    return new MysqlQuery(table)
  }

  // Tidak dipakai lagi (upload gambar dipindah ke storage lokal),
  // dipertahankan agar import lama tidak error.
  get storage(): never {
    throw new Error('Supabase Storage tidak tersedia. Gunakan /api/uploads (lokal).')
  }
}

export function createMysqlClient(): MysqlClient {
  return new MysqlClient()
}
