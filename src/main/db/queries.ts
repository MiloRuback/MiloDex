import { getDatabase } from './database'

// ─── Library ────────────────────────────────────────────────────────────────

export function getAllLibrary(): any[] {
  return getDatabase().all('SELECT * FROM library ORDER BY updated_at DESC')
}

export function getLibraryByStatus(status: string): any[] {
  return getDatabase().all('SELECT * FROM library WHERE status = ? ORDER BY updated_at DESC', [status])
}

export function addToLibrary(entry: {
  id: string; title: string; cover_url?: string; cover_local?: string
  type?: string; source?: string; status?: string; mangadex_id?: string
  file_path?: string; author?: string; description?: string
  total_chapters?: number; rating?: number; tags?: string
}): void {
  getDatabase().run(`
    INSERT OR REPLACE INTO library
    (id, title, cover_url, cover_local, type, source, status, mangadex_id, file_path,
     author, description, total_chapters, rating, tags, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
  `, [
    entry.id, entry.title,
    entry.cover_url || null, entry.cover_local || null,
    entry.type || 'manga', entry.source || 'local', entry.status || 'reading',
    entry.mangadex_id || null, entry.file_path || null,
    entry.author || null, entry.description || null,
    entry.total_chapters || 0, entry.rating || 0, entry.tags || '[]'
  ])
}

export function updateLibraryStatus(id: string, status: string): void {
  getDatabase().run(
    "UPDATE library SET status = ?, updated_at = strftime('%s','now') WHERE id = ?",
    [status, id]
  )
}

export function removeFromLibrary(id: string): void {
  const db = getDatabase()
  db.run('DELETE FROM library WHERE id = ?', [id])
  db.run('DELETE FROM history WHERE manga_id = ?', [id])
  db.run('DELETE FROM annotations WHERE manga_id = ?', [id])
}

export function getMangaById(id: string): any {
  return getDatabase().get('SELECT * FROM library WHERE id = ?', [id])
}

// ─── History ────────────────────────────────────────────────────────────────

export function getHistory(mangaId: string): any {
  return getDatabase().get('SELECT * FROM history WHERE manga_id = ?', [mangaId])
}

export function saveHistory(entry: {
  manga_id: string; chapter_id?: string; chapter_number?: number
  page_index?: number; total_pages?: number; zoom_level?: number
  scroll_x?: number; scroll_y?: number; read_mode?: string
}): void {
  const db = getDatabase()
  const existing = db.get('SELECT id FROM history WHERE manga_id = ?', [entry.manga_id])
  if (existing) {
    db.run(`
      UPDATE history SET chapter_id=?, chapter_number=?, page_index=?, total_pages=?,
        zoom_level=?, scroll_x=?, scroll_y=?, read_mode=?,
        updated_at=strftime('%s','now')
      WHERE manga_id=?
    `, [
      entry.chapter_id || null, entry.chapter_number || 0,
      entry.page_index || 0, entry.total_pages || 0,
      entry.zoom_level || 1.0, entry.scroll_x || 0,
      entry.scroll_y || 0, entry.read_mode || 'rtl',
      entry.manga_id
    ])
  } else {
    db.run(`
      INSERT INTO history
      (manga_id, chapter_id, chapter_number, page_index, total_pages, zoom_level, scroll_x, scroll_y, read_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entry.manga_id, entry.chapter_id || null,
      entry.chapter_number || 0, entry.page_index || 0,
      entry.total_pages || 0, entry.zoom_level || 1.0,
      entry.scroll_x || 0, entry.scroll_y || 0, entry.read_mode || 'rtl'
    ])
  }
}

export function getRecentHistory(limit = 10): any[] {
  return getDatabase().all(`
    SELECT h.*, l.title, l.cover_url, l.cover_local, l.type
    FROM history h
    JOIN library l ON h.manga_id = l.id
    ORDER BY h.updated_at DESC
    LIMIT ?
  `, [limit])
}

// ─── Annotations ────────────────────────────────────────────────────────────

export function getAnnotations(mangaId: string, chapterId: string, pageIndex: number): any[] {
  return getDatabase().all(
    'SELECT * FROM annotations WHERE manga_id=? AND chapter_id=? AND page_index=?',
    [mangaId, chapterId, pageIndex]
  )
}

export function saveAnnotation(a: {
  id: string; manga_id: string; chapter_id: string; page_index: number
  type: string; x: number; y: number; width?: number; height?: number
  content?: string; font_size?: number; font_color?: string; bg_color?: string
  image_path?: string; z_index?: number
}): void {
  getDatabase().run(`
    INSERT OR REPLACE INTO annotations
    (id, manga_id, chapter_id, page_index, type, x, y, width, height, content,
     font_size, font_color, bg_color, image_path, z_index, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,strftime('%s','now'))
  `, [
    a.id, a.manga_id, a.chapter_id, a.page_index, a.type,
    a.x, a.y, a.width || 200, a.height || 100,
    a.content || null, a.font_size || 14,
    a.font_color || '#ffffff', a.bg_color || 'rgba(0,0,0,0.7)',
    a.image_path || null, a.z_index || 1
  ])
}

export function deleteAnnotation(id: string): void {
  getDatabase().run('DELETE FROM annotations WHERE id=?', [id])
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = getDatabase().get('SELECT value FROM settings WHERE key=?', [key]) as any
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDatabase().run('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', [key, value])
}

export function getAllSettings(): Record<string, string> {
  const rows = getDatabase().all('SELECT key, value FROM settings') as any[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
