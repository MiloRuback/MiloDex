export interface LibraryEntry {
  id: string
  title: string
  cover_url?: string
  cover_local?: string
  type: 'manga' | 'comic' | 'book'
  source: 'local' | 'mangadex'
  status: 'reading' | 'completed' | 'planned' | 'paused' | 'dropped'
  mangadex_id?: string
  file_path?: string
  author?: string
  description?: string
  total_chapters?: number
  rating?: number
  tags?: string
  added_at?: number
  updated_at?: number
}

export interface HistoryEntry {
  id?: number
  manga_id: string
  chapter_id?: string
  chapter_number?: number
  page_index?: number
  total_pages?: number
  zoom_level?: number
  scroll_x?: number
  scroll_y?: number
  read_mode?: 'rtl' | 'ltr' | 'scroll'
  updated_at?: number
  // joined fields
  title?: string
  cover_url?: string
  cover_local?: string
  type?: string
}

export interface Annotation {
  id: string
  manga_id: string
  chapter_id: string
  page_index: number
  type: 'text' | 'image'
  x: number
  y: number
  width?: number
  height?: number
  content?: string
  font_size?: number
  font_color?: string
  bg_color?: string
  image_path?: string
  z_index?: number
}

export interface MangaDexManga {
  id: string
  attributes: {
    title: Record<string, string>
    description: Record<string, string>
    status: string
    year?: number
    tags: Array<{ id: string; attributes: { name: Record<string, string>; group: string } }>
    publicationDemographic?: string
    contentRating: string
    lastChapter?: string
    lastVolume?: string
  }
  relationships: Array<{
    id: string
    type: string
    attributes?: {
      fileName?: string
      name?: string
    }
  }>
}

export interface MangaDexChapter {
  id: string
  attributes: {
    title?: string
    volume?: string
    chapter?: string
    pages: number
    translatedLanguage: string
    publishAt: string
    externalUrl?: string
    uploader?: string
  }
  relationships: Array<{ id: string; type: string; attributes?: { name?: string } }>
}

export interface MiloDexAPI {
  platform?: 'desktop' | 'mobile'
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    fullscreen: () => void
  }
  library: {
    getAll: () => Promise<LibraryEntry[]>
    getByStatus: (status: string) => Promise<LibraryEntry[]>
    add: (entry: Partial<LibraryEntry>) => Promise<any>
    updateStatus: (id: string, status: string) => Promise<any>
    remove: (id: string) => Promise<any>
    getById: (id: string) => Promise<LibraryEntry | null>
  }
  history: {
    get: (mangaId: string) => Promise<HistoryEntry | null>
    save: (entry: Partial<HistoryEntry>) => Promise<any>
    getRecent: (limit?: number) => Promise<HistoryEntry[]>
  }
  annotations: {
    get: (mangaId: string, chapterId: string, pageIndex: number) => Promise<Annotation[]>
    save: (annotation: Annotation) => Promise<any>
    delete: (id: string) => Promise<any>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<any>
    getAll: () => Promise<Record<string, string>>
  }
  files: {
    openPicker: () => Promise<string[]>
    parse: (filePath: string) => Promise<ParsedFile>
    readAsBase64: (filePath: string) => Promise<string | null>
    getMetadata: (filePath: string) => Promise<FileMetadata | null>
    pickImage: () => Promise<string | null>
  }
  mangadex: {
    search: (query: string, filters: SearchFilters) => Promise<any>
    getManga: (id: string) => Promise<MangaDexManga>
    getChapters: (mangaId: string, lang?: string, limit?: number, offset?: number) => Promise<any>
    getChapterImages: (chapterId: string) => Promise<{ pages: string[]; dataSaver: string[] }>
    getImageDataUrl: (url: string) => Promise<string>
    getTrending: () => Promise<any>
    downloadChapter: (chapterId: string, mangaTitle: string, chapterNumber: string) => Promise<{ success: boolean; path?: string; error?: string }>
  }
}

export interface ParsedFile {
  type: 'images' | 'html' | 'pdf' | 'epub' | 'error'
  pages?: string[]
  html?: string
  path?: string
  error?: string
}

export interface FileMetadata {
  name: string
  ext: string
  size: number
  path: string
}

export interface SearchFilters {
  status?: string[]
  genres?: string[]
  demographic?: string[]
  language?: string
  limit?: number
  offset?: number
}

declare global {
  interface Window {
    milodex: MiloDexAPI
  }
}
