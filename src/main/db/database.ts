import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

let db: any = null
let dbPath = ''
let SqlDatabase: any = null

export async function initDatabase(): Promise<void> {
  try {
    // sql.js uses WebAssembly - no native compilation needed
    const initSqlJs = require('sql.js')
    const SQL = await initSqlJs()
    SqlDatabase = SQL

    const userDataPath = app.getPath('userData')
    dbPath = path.join(userDataPath, 'miodex.db')

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath)
      db = new SQL.Database(fileBuffer)
    } else {
      db = new SQL.Database()
    }

    createTables()
    persistDb()
    console.log('[MiloDex] Database initialized at:', dbPath)

    // Auto-persist every 30s to avoid data loss
    setInterval(persistDb, 30000)
  } catch (err) {
    console.error('[MiloDex] Database init error:', err)
  }
}

export function persistDb(): void {
  if (!db || !dbPath) return
  try {
    const data: Uint8Array = db.export()
    const buffer = Buffer.from(data)
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(dbPath, buffer)
  } catch (e) {
    console.error('[MiloDex] DB persist error:', e)
  }
}

function runSql(sql: string, params: any[] = []) {
  db.run(sql, params)
  persistDb()
}

function querySingle(sql: string, params: any[] = []): any {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return convertRow(row)
  }
  stmt.free()
  return null
}

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: any[] = []
  while (stmt.step()) {
    rows.push(convertRow(stmt.getAsObject()))
  }
  stmt.free()
  return rows
}

// sql.js returns BigInt for INTEGER - convert to regular numbers
function convertRow(row: any): any {
  if (!row) return row
  const result: any = {}
  for (const key of Object.keys(row)) {
    const val = row[key]
    result[key] = typeof val === 'bigint' ? Number(val) : val
  }
  return result
}

export function getDatabase() {
  return {
    run: (sql: string, params: any[] = []) => runSql(sql, params),
    get: (sql: string, params: any[] = []) => querySingle(sql, params),
    all: (sql: string, params: any[] = []) => queryAll(sql, params),
    exec: (sql: string) => { db.run(sql); persistDb() }
  }
}

function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS library (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cover_url TEXT,
      cover_local TEXT,
      type TEXT NOT NULL DEFAULT 'manga',
      source TEXT NOT NULL DEFAULT 'local',
      status TEXT NOT NULL DEFAULT 'reading',
      mangadex_id TEXT,
      file_path TEXT,
      author TEXT,
      description TEXT,
      total_chapters INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      tags TEXT DEFAULT '[]',
      added_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manga_id TEXT NOT NULL,
      chapter_id TEXT,
      chapter_number REAL DEFAULT 0,
      page_index INTEGER DEFAULT 0,
      total_pages INTEGER DEFAULT 0,
      zoom_level REAL DEFAULT 1.0,
      scroll_x REAL DEFAULT 0,
      scroll_y REAL DEFAULT 0,
      read_mode TEXT DEFAULT 'rtl',
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      manga_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      page_index INTEGER NOT NULL,
      type TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL DEFAULT 200,
      height REAL DEFAULT 100,
      content TEXT,
      font_size INTEGER DEFAULT 14,
      font_color TEXT DEFAULT '#ffffff',
      bg_color TEXT DEFAULT 'rgba(0,0,0,0.7)',
      image_path TEXT,
      z_index INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  const defaults: [string, string][] = [
    ['theme', 'dark'],
    ['read_mode', 'rtl'],
    ['page_view', 'single'],
    ['zoom_default', '1.0'],
    ['hotkey_next_page', 'ArrowRight'],
    ['hotkey_prev_page', 'ArrowLeft'],
    ['hotkey_fullscreen', 'F11'],
    ['hotkey_zoom_in', '+'],
    ['hotkey_zoom_out', '-'],
    ['hotkey_library', 'l'],
    ['ui_language', 'pt-br'],
    ['reader_bg', '#000000']
  ]
  for (const [key, value] of defaults) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value])
  }

  console.log('[MiloDex] Tables created/verified')
}
