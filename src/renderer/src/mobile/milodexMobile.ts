import JSZip from 'jszip'
import type {
  Annotation,
  FileMetadata,
  HistoryEntry,
  LibraryEntry,
  MiloDexAPI,
  ParsedFile,
  SearchFilters
} from '../types/global'

const MANGADEX_API = 'https://api.mangadex.org'
const STORAGE_PREFIX = 'milodex.mobile.'
const FILE_DB_NAME = 'milodex-mobile-files'
const FILE_STORE_NAME = 'files'
const MOBILE_LOCAL_FILE_ACCEPT = '.cbz,.txt,.htm,.html'

type StoredFile = {
  id: string
  name: string
  ext: string
  type: string
  size: number
  lastModified: number
  data: ArrayBuffer
}

const defaultSettings: Record<string, string> = {
  theme: 'dark',
  read_mode: 'rtl',
  page_view: 'single',
  zoom_default: '1.0',
  ui_language: 'pt-br',
  mangadex_language: 'pt-br',
  reader_bg: '#000000'
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value))
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function getLibrary(): LibraryEntry[] {
  return readJson<LibraryEntry[]>('library', [])
}

function saveLibrary(items: LibraryEntry[]): void {
  writeJson('library', items)
}

function getHistoryMap(): Record<string, HistoryEntry> {
  return readJson<Record<string, HistoryEntry>>('history', {})
}

function saveHistoryMap(items: Record<string, HistoryEntry>): void {
  writeJson('history', items)
}

function getAnnotationsList(): Annotation[] {
  return readJson<Annotation[]>('annotations', [])
}

function saveAnnotationsList(items: Annotation[]): void {
  writeJson('annotations', items)
}

function getSettings(): Record<string, string> {
  return { ...defaultSettings, ...readJson<Record<string, string>>('settings', {}) }
}

function saveSettings(settings: Record<string, string>): void {
  writeJson('settings', settings)
}

function appendArrayParam(params: URLSearchParams, key: string, values?: string[]): void {
  if (!values || values.length === 0) return
  for (const value of values) params.append(key, value)
}

function shouldFilterLanguage(language?: string): boolean {
  return Boolean(language && language !== 'all')
}

async function apiGet(path: string, params: URLSearchParams): Promise<any> {
  const url = `${MANGADEX_API}${path}?${params.toString()}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`MangaDex respondeu ${response.status}`)
  return response.json()
}

function openFileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        db.createObjectStore(FILE_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function putStoredFile(file: StoredFile): Promise<void> {
  const db = await openFileDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE_NAME, 'readwrite')
    tx.objectStore(FILE_STORE_NAME).put(file)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function getStoredFile(id: string): Promise<StoredFile | null> {
  const db = await openFileDb()
  const file = await new Promise<StoredFile | null>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE_NAME, 'readonly')
    const request = tx.objectStore(FILE_STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return file
}

function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => {
      const files = Array.from(input.files || [])
      input.remove()
      resolve(files)
    }
    input.click()
  })
}

function fileExt(name: string): string {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

function mimeForImage(name: string): string {
  const ext = fileExt(name)
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/jpeg'
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function parseStoredFile(filePath: string): Promise<ParsedFile> {
  const stored = await getStoredFile(filePath)
  if (!stored) return { type: 'error', error: 'Arquivo nao encontrado no armazenamento do app.' }

  if (stored.ext === '.cbz') {
    const zip = await JSZip.loadAsync(stored.data)
    const imageEntries = Object.values(zip.files)
      .filter((entry) => !entry.dir && /\.(jpe?g|png|webp|gif)$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

    const pages = await Promise.all(
      imageEntries.map(async (entry) => {
        const blob = await entry.async('blob')
        return URL.createObjectURL(new Blob([blob], { type: mimeForImage(entry.name) }))
      })
    )
    return { type: 'images', pages }
  }

  if (stored.ext === '.txt') {
    const text = new TextDecoder('utf-8').decode(stored.data)
    return {
      type: 'html',
      html: `<html><body style="background:#0f0f14;color:#f4f4f5;font-family:system-ui,sans-serif;line-height:1.7;padding:28px;white-space:pre-wrap">${text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] || char)}</body></html>`
    }
  }

  if (stored.ext === '.html' || stored.ext === '.htm') {
    return { type: 'html', html: new TextDecoder('utf-8').decode(stored.data) }
  }

  if (stored.ext === '.cbr') return { type: 'error', error: 'CBR/RAR ainda nao e suportado no APK. Use CBZ para leitura local.' }
  return { type: 'error', error: `Formato ${stored.ext || stored.name} nao suportado no APK.` }
}

async function installMobileMilodex(): Promise<void> {
  if ((window as any).milodex) return

  const api: MiloDexAPI = {
    platform: 'mobile',
    window: {
      minimize: () => undefined,
      maximize: () => undefined,
      close: () => undefined,
      fullscreen: () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
        else document.documentElement.requestFullscreen?.().catch(() => undefined)
      }
    },
    library: {
      getAll: async () => getLibrary().sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0)),
      getByStatus: async (status: string) => getLibrary().filter((item) => item.status === status),
      add: async (entry: Partial<LibraryEntry>) => {
        const items = getLibrary()
        const id = entry.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const nextEntry: LibraryEntry = {
          id,
          title: entry.title || 'Sem titulo',
          type: entry.type || 'manga',
          source: entry.source || 'mangadex',
          status: entry.status || 'reading',
          added_at: entry.added_at || nowSeconds(),
          updated_at: nowSeconds(),
          ...entry
        } as LibraryEntry
        saveLibrary([nextEntry, ...items.filter((item) => item.id !== id)])
      },
      updateStatus: async (id: string, status: string) => {
        saveLibrary(getLibrary().map((item) => item.id === id ? { ...item, status: status as any, updated_at: nowSeconds() } : item))
      },
      remove: async (id: string) => {
        saveLibrary(getLibrary().filter((item) => item.id !== id))
        const histories = getHistoryMap()
        delete histories[id]
        saveHistoryMap(histories)
        saveAnnotationsList(getAnnotationsList().filter((item) => item.manga_id !== id))
      },
      getById: async (id: string) => getLibrary().find((item) => item.id === id) || null
    },
    history: {
      get: async (mangaId: string) => getHistoryMap()[mangaId] || null,
      save: async (entry: Partial<HistoryEntry>) => {
        if (!entry.manga_id) return
        const histories = getHistoryMap()
        histories[entry.manga_id] = { ...histories[entry.manga_id], ...entry, updated_at: nowSeconds() } as HistoryEntry
        saveHistoryMap(histories)
      },
      getRecent: async (limit = 10) => {
        const library = getLibrary()
        return Object.values(getHistoryMap())
          .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
          .slice(0, limit)
          .map((history) => {
            const item = library.find((entry) => entry.id === history.manga_id)
            return { ...history, title: item?.title, cover_url: item?.cover_url, cover_local: item?.cover_local, type: item?.type }
          })
      }
    },
    annotations: {
      get: async (mangaId: string, chapterId: string, pageIndex: number) =>
        getAnnotationsList().filter((item) => item.manga_id === mangaId && item.chapter_id === chapterId && item.page_index === pageIndex),
      save: async (annotation: Annotation) => {
        const annotations = getAnnotationsList()
        saveAnnotationsList([annotation, ...annotations.filter((item) => item.id !== annotation.id)])
      },
      delete: async (id: string) => saveAnnotationsList(getAnnotationsList().filter((item) => item.id !== id))
    },
    settings: {
      get: async (key: string) => getSettings()[key] || null,
      set: async (key: string, value: string) => saveSettings({ ...getSettings(), [key]: value }),
      getAll: async () => getSettings()
    },
    files: {
      openPicker: async () => {
        const files = await pickFiles(MOBILE_LOCAL_FILE_ACCEPT, true)
        const ids: string[] = []
        for (const file of files) {
          const id = `mobile-file:${Date.now()}-${Math.random().toString(36).slice(2)}`
          await putStoredFile({
            id,
            name: file.name.replace(/\.[^.]+$/, ''),
            ext: fileExt(file.name),
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            data: await file.arrayBuffer()
          })
          ids.push(id)
        }
        return ids
      },
      parse: parseStoredFile,
      readAsBase64: async (filePath: string) => {
        const file = await getStoredFile(filePath)
        return file ? arrayBufferToBase64(file.data) : null
      },
      getMetadata: async (filePath: string): Promise<FileMetadata | null> => {
        const file = await getStoredFile(filePath)
        if (!file) return null
        return { name: file.name, ext: file.ext, size: file.size, path: file.id }
      },
      pickImage: async () => {
        const [file] = await pickFiles('image/*', false)
        if (!file) return null
        return blobToDataUrl(file)
      }
    },
    mangadex: {
      search: async (query: string, filters: SearchFilters) => {
        const params = new URLSearchParams()
        params.set('title', query)
        params.set('limit', String(filters.limit || 24))
        params.set('offset', String(filters.offset || 0))
        params.append('includes[]', 'cover_art')
        params.append('includes[]', 'author')
        appendArrayParam(params, 'contentRating[]', ['safe', 'suggestive', 'erotica'])
        params.set('order[relevance]', 'desc')
        appendArrayParam(params, 'status[]', filters.status)
        appendArrayParam(params, 'publicationDemographic[]', filters.demographic)
        if (shouldFilterLanguage(filters.language)) params.append('availableTranslatedLanguage[]', filters.language!)
        return apiGet('/manga', params)
      },
      getManga: async (id: string) => {
        const params = new URLSearchParams()
        params.append('includes[]', 'cover_art')
        params.append('includes[]', 'author')
        params.append('includes[]', 'artist')
        const res = await apiGet(`/manga/${id}`, params)
        return res.data
      },
      getChapters: async (mangaId: string, lang = 'pt-br', limit = 100, offset = 0) => {
        const params = new URLSearchParams()
        params.set('limit', String(Math.min(Math.max(limit || 100, 1), 500)))
        params.set('offset', String(offset))
        params.set('order[chapter]', 'asc')
        params.set('order[publishAt]', 'asc')
        params.append('includes[]', 'scanlation_group')
        params.append('includes[]', 'user')
        params.set('includeExternalUrl', '0')
        params.set('includeEmptyPages', '0')
        if (shouldFilterLanguage(lang)) params.append('translatedLanguage[]', lang)
        return apiGet(`/manga/${mangaId}/feed`, params)
      },
      getChapterImages: async (chapterId: string) => {
        const response = await fetch(`${MANGADEX_API}/at-home/server/${chapterId}`)
        if (!response.ok) throw new Error(`MangaDex respondeu ${response.status}`)
        const { baseUrl, chapter } = await response.json()
        const data = Array.isArray(chapter?.data) ? chapter.data : []
        const saver = Array.isArray(chapter?.dataSaver) ? chapter.dataSaver : []
        if (!baseUrl || !chapter?.hash || (data.length === 0 && saver.length === 0)) {
          throw new Error('Este capitulo nao possui paginas hospedadas no MangaDex.')
        }
        return {
          pages: data.map((filename: string) => `${baseUrl}/data/${chapter.hash}/${filename}`),
          dataSaver: saver.map((filename: string) => `${baseUrl}/data-saver/${chapter.hash}/${filename}`)
        }
      },
      getImageDataUrl: async (url: string) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Imagem respondeu ${response.status}`)
        return blobToDataUrl(await response.blob())
      },
      getTrending: async () => {
        const params = new URLSearchParams()
        params.set('limit', '12')
        params.append('includes[]', 'cover_art')
        params.set('order[followedCount]', 'desc')
        params.append('contentRating[]', 'safe')
        params.append('contentRating[]', 'suggestive')
        params.set('hasAvailableChapters', 'true')
        return apiGet('/manga', params)
      },
      downloadChapter: async (chapterId: string, mangaTitle: string, chapterNumber: string) => {
        try {
          const { pages } = await api.mangadex.getChapterImages(chapterId)
          const zip = new JSZip()
          for (let i = 0; i < pages.length; i++) {
            const response = await fetch(pages[i])
            const blob = await response.blob()
            const ext = fileExt(new URL(pages[i]).pathname) || '.jpg'
            zip.file(`page_${String(i + 1).padStart(3, '0')}${ext}`, blob)
          }
          const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
          const safeName = `${mangaTitle} - Ch.${chapterNumber}`.replace(/[<>:"/\\|?*]/g, '_')
          const link = document.createElement('a')
          link.href = URL.createObjectURL(content)
          link.download = `${safeName}.cbz`
          link.click()
          setTimeout(() => URL.revokeObjectURL(link.href), 30000)
          return { success: true, path: `${safeName}.cbz` }
        } catch (err: any) {
          return { success: false, error: err.message || 'Erro no download' }
        }
      }
    }
  }

  ;(window as any).milodex = api
}

void installMobileMilodex()
