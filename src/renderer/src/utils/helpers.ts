import type { MangaDexChapter, MangaDexManga } from '../types/global'

export const MANGADEX_LANGUAGES = [
  { value: 'pt-br', label: 'Português (BR)' },
  { value: 'en', label: 'English' },
  { value: 'es-la', label: 'Español (LATAM)' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
  { value: 'zh-hk', label: '中文 (HK)' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'ru', label: 'Русский' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'pl', label: 'Polski' },
  { value: 'ar', label: 'العربية' }
]

export const MANGADEX_LANGUAGE_FILTERS = [
  ...MANGADEX_LANGUAGES,
  { value: 'all', label: 'Todos os idiomas' }
]

// Extract cover URL from MangaDex manga object
export function getMangaCover(manga: MangaDexManga, size: '256' | '512' | 'original' = '512'): string {
  const coverRel = manga.relationships.find((r) => r.type === 'cover_art')
  if (!coverRel || !coverRel.attributes?.fileName) return ''
  return `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}.${size}.jpg`
}

// Extract author from MangaDex manga object
export function getMangaAuthor(manga: MangaDexManga): string {
  const authorRel = manga.relationships.find((r) => r.type === 'author')
  return authorRel?.attributes?.name || 'Desconhecido'
}

// Get localized title (prefer pt, then en, then first available)
export function getMangaTitle(manga: MangaDexManga, lang = 'pt-br'): string {
  const titles = manga.attributes.title
  return (
    titles[lang] ||
    titles['pt'] ||
    titles['en'] ||
    Object.values(titles)[0] ||
    'Sem título'
  )
}

// Get localized description
export function getMangaDescription(manga: MangaDexManga, lang = 'pt-br'): string {
  const descs = manga.attributes.description
  return descs[lang] || descs['pt'] || descs['en'] || Object.values(descs)[0] || ''
}

export function formatMangaDexLanguage(lang?: string): string {
  if (!lang) return 'Idioma desconhecido'
  return MANGADEX_LANGUAGE_FILTERS.find((l) => l.value === lang)?.label || lang.toUpperCase()
}

export function getChapterGroupName(chapter: MangaDexChapter): string {
  const group = chapter.relationships?.find((r) => r.type === 'scanlation_group')
  return group?.attributes?.name || 'Sem grupo'
}

export function isReadableChapter(chapter: MangaDexChapter): boolean {
  return !chapter.attributes.externalUrl && (chapter.attributes.pages || 0) > 0
}

export function sortMangaDexChapters<T extends MangaDexChapter>(chapters: T[]): T[] {
  return [...chapters].sort((a, b) => {
    const chapterA = Number.parseFloat(a.attributes.chapter || '0')
    const chapterB = Number.parseFloat(b.attributes.chapter || '0')
    if (Number.isFinite(chapterA) && Number.isFinite(chapterB) && chapterA !== chapterB) {
      return chapterA - chapterB
    }
    return new Date(a.attributes.publishAt || 0).getTime() - new Date(b.attributes.publishAt || 0).getTime()
  })
}

export function formatChapterOption(chapter: MangaDexChapter): string {
  const number = chapter.attributes.chapter ? `Cap. ${chapter.attributes.chapter}` : 'Oneshot'
  const title = chapter.attributes.title ? ` - ${chapter.attributes.title}` : ''
  const lang = chapter.attributes.translatedLanguage.toUpperCase()
  const group = getChapterGroupName(chapter)
  const pages = `${chapter.attributes.pages || 0}p`
  return `${number}${title} | ${lang} | ${group} | ${pages}`
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Calculate read progress percent
export function calcProgress(currentPage: number, totalPages: number): number {
  if (totalPages === 0) return 0
  return Math.round((currentPage / totalPages) * 100)
}

// Status labels in Portuguese
export const STATUS_LABELS: Record<string, string> = {
  reading: 'Lendo',
  completed: 'Lido',
  planned: 'Quero Ler',
  paused: 'Pausado',
  dropped: 'Abandonado'
}

export const STATUS_CLASSES: Record<string, string> = {
  reading: 'badge-reading',
  completed: 'badge-completed',
  planned: 'badge-planned',
  paused: 'badge-paused',
  dropped: 'badge-dropped'
}
