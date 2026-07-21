import type { MangaDexManga } from '../types/global'

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
