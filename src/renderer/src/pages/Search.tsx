import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BookmarkPlus, Filter, Search as SearchIcon, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type { MangaDexChapter, MangaDexManga } from '../types/global'
import {
  MANGADEX_LANGUAGE_FILTERS,
  formatChapterOption,
  formatMangaDexLanguage,
  generateId,
  getMangaAuthor,
  getMangaCover,
  getMangaDescription,
  getMangaTitle,
  isReadableChapter,
  sortMangaDexChapters
} from '../utils/helpers'

const STATUSES = [
  { value: 'ongoing', label: 'Em andamento' },
  { value: 'completed', label: 'Completo' },
  { value: 'hiatus', label: 'Em hiato' },
  { value: 'cancelled', label: 'Cancelado' }
]

const DEMOGRAPHICS = [
  { value: 'shounen', label: 'Shounen' },
  { value: 'shoujo', label: 'Shoujo' },
  { value: 'seinen', label: 'Seinen' },
  { value: 'josei', label: 'Josei' }
]

const LIMIT = 24

export default function Search() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { library, fetchLibrary, showToast, settings, updateSetting } = useAppStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MangaDexManga[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedDemographic, setSelectedDemographic] = useState<string[]>([])
  const [selectedLang, setSelectedLang] = useState(settings.mangadex_language || 'pt-br')
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [selectedManga, setSelectedManga] = useState<MangaDexManga | null>(null)
  const [chaptersData, setChaptersData] = useState<MangaDexChapter[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const visibleChapters = useMemo(
    () =>
      chaptersData.filter(
        (chapter) => selectedLang === 'all' || chapter.attributes.translatedLanguage === selectedLang
      ),
    [chaptersData, selectedLang]
  )
  const readableVisibleChapters = useMemo(
    () => visibleChapters.filter(isReadableChapter),
    [visibleChapters]
  )

  useEffect(() => {
    if (settings.mangadex_language && settings.mangadex_language !== selectedLang) {
      setSelectedLang(settings.mangadex_language)
    }
  }, [settings.mangadex_language])

  const chooseLanguage = (lang: string) => {
    setSelectedLang(lang)
    updateSetting('mangadex_language', lang)
  }

  const handleSearch = useCallback(
    async (q: string, off = 0) => {
      if (!q.trim()) return
      setLoading(true)
      try {
        const res = await window.milodex.mangadex.search(q, {
          status: selectedStatus,
          demographic: selectedDemographic,
          language: selectedLang,
          limit: LIMIT,
          offset: off
        })
        if (off === 0) setResults(res.data || [])
        else setResults((prev) => [...prev, ...(res.data || [])])
        setTotal(res.total || 0)
        setOffset(off)
      } catch {
        showToast({ message: 'Erro ao buscar no MangaDex. Verifique sua conexao.', type: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [selectedStatus, selectedDemographic, selectedLang, showToast]
  )

  const loadChapters = useCallback(async (mangaId: string) => {
    setChaptersLoading(true)
    try {
      const res = await window.milodex.mangadex.getChapters(mangaId, 'all', 500, 0)
      setChaptersData(sortMangaDexChapters(res.data || []))
    } catch {
      setChaptersData([])
    } finally {
      setChaptersLoading(false)
    }
  }, [])

  const openMangaDetails = useCallback(
    (manga: MangaDexManga) => {
      setSelectedManga(manga)
      setChaptersData([])
      void loadChapters(manga.id)
    },
    [loadChapters]
  )

  const loadMangaDetails = useCallback(
    async (id: string) => {
      try {
        const manga = await window.milodex.mangadex.getManga(id)
        openMangaDetails(manga)
      } catch {
        showToast({ message: 'Nao foi possivel carregar este manga.', type: 'error' })
      }
    },
    [openMangaDetails, showToast]
  )

  useEffect(() => {
    const mangaId = searchParams.get('manga')
    if (mangaId) void loadMangaDetails(mangaId)
  }, [searchParams, loadMangaDetails])

  const isInLibrary = (mangaId: string) => library.some((l) => l.mangadex_id === mangaId)

  const ensureMangaInLibrary = async (manga: MangaDexManga): Promise<string | null> => {
    const currentItems = await window.milodex.library.getAll()
    const existing =
      library.find((l) => l.mangadex_id === manga.id) ||
      currentItems.find((l: any) => l.mangadex_id === manga.id)
    if (existing) return existing.id

    const entryId = generateId()
    await window.milodex.library.add({
      id: entryId,
      title: getMangaTitle(manga),
      cover_url: getMangaCover(manga, '512'),
      type: 'manga',
      source: 'mangadex',
      status: 'planned',
      mangadex_id: manga.id,
      author: getMangaAuthor(manga),
      description: getMangaDescription(manga),
      tags: JSON.stringify(
        manga.attributes.tags
          .filter((t) => t.attributes.group === 'genre')
          .map((t) => t.attributes.name.en || t.attributes.name['pt-br'] || '')
      )
    })
    await fetchLibrary()
    showToast({ message: `"${getMangaTitle(manga)}" adicionado a biblioteca!`, type: 'success' })
    return entryId
  }

  const handleAddToLibrary = async (manga: MangaDexManga) => {
    if (isInLibrary(manga.id)) return
    await ensureMangaInLibrary(manga)
  }

  const handleReadOnline = async (manga: MangaDexManga, chapterId?: string) => {
    const targetChapterId = chapterId || readableVisibleChapters[0]?.id
    if (!targetChapterId) {
      showToast({
        message: `Nenhum capitulo legivel em ${formatMangaDexLanguage(selectedLang)}.`,
        type: 'error'
      })
      return
    }

    const entryId = await ensureMangaInLibrary(manga)
    if (entryId) {
      const params = new URLSearchParams({ chapter: targetChapterId, lang: selectedLang })
      navigate(`/reader/${entryId}?${params.toString()}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ paddingBottom: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 16 }}>Buscar no MangaDex</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <SearchIcon size={16} color="hsl(var(--muted-foreground))" />
            <input
              className="search-input"
              placeholder="Buscar mangas, autores, titulos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch(query, 0)
              }}
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  setResults([])
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => handleSearch(query, 0)} disabled={loading}>
            {loading ? '...' : 'Buscar'}
          </button>
          <button
            className={`btn btn-secondary ${showFilters ? 'btn-primary' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filtros"
          >
            <Filter size={15} />
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', marginTop: 12 }}
            >
              <div style={{ padding: 16, background: 'hsl(var(--card))', borderRadius: 12, border: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--muted-foreground))' }}>STATUS</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STATUSES.map((status) => (
                      <button
                        key={status.value}
                        className={`filter-chip ${selectedStatus.includes(status.value) ? 'active' : ''}`}
                        onClick={() =>
                          setSelectedStatus((prev) =>
                            prev.includes(status.value) ? prev.filter((x) => x !== status.value) : [...prev, status.value]
                          )
                        }
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--muted-foreground))' }}>DEMOGRAFIA</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DEMOGRAPHICS.map((demographic) => (
                      <button
                        key={demographic.value}
                        className={`filter-chip ${selectedDemographic.includes(demographic.value) ? 'active' : ''}`}
                        onClick={() =>
                          setSelectedDemographic((prev) =>
                            prev.includes(demographic.value)
                              ? prev.filter((x) => x !== demographic.value)
                              : [...prev, demographic.value]
                          )
                        }
                      >
                        {demographic.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--muted-foreground))' }}>IDIOMA</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {MANGADEX_LANGUAGE_FILTERS.map((lang) => (
                      <button
                        key={lang.value}
                        className={`filter-chip ${selectedLang === lang.value ? 'active' : ''}`}
                        onClick={() => chooseLanguage(lang.value)}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px 32px' }}>
        {results.length === 0 && !loading && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state-icon">?</div>
            <p className="empty-state-title">Busque seu proximo manga favorito</p>
            <p className="empty-state-desc">Digite um titulo, autor ou genero para comecar</p>
          </div>
        )}

        {loading && results.length === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {Array(12)
              .fill(0)
              .map((_, i) => (
                <div key={i}>
                  <div className="shimmer" style={{ aspectRatio: '2/3', borderRadius: 12, marginBottom: 8 }} />
                  <div className="shimmer" style={{ height: 12, borderRadius: 6, width: '80%' }} />
                </div>
              ))}
          </div>
        )}

        {results.length > 0 && (
          <>
            <p style={{ fontSize: 12.5, color: 'hsl(var(--muted-foreground))', marginBottom: 16 }}>
              {total} resultados | exibindo {results.length}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
              {results.map((manga) => {
                const inLib = isInLibrary(manga.id)
                return (
                  <motion.div
                    key={manga.id}
                    className="manga-card"
                    whileHover={{ y: -4, scale: 1.02 }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ cursor: 'pointer' }}
                    onClick={() => openMangaDetails(manga)}
                  >
                    <img src={getMangaCover(manga)} alt={getMangaTitle(manga)} className="manga-card-cover" loading="lazy" />
                    <div className="manga-card-overlay">
                      <p className="manga-card-title">{getMangaTitle(manga)}</p>
                    </div>
                    {inLib && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: 'hsl(var(--primary) / 0.9)', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                        Na biblioteca
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
            {results.length < total && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={() => handleSearch(query, offset + LIMIT)} disabled={loading}>
                  {loading ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedManga && (
          <div className="modal-overlay" onClick={() => setSelectedManga(null)}>
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}
            >
              <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
                <img
                  src={getMangaCover(selectedManga, '512')}
                  alt={getMangaTitle(selectedManga)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px) brightness(0.4)', transform: 'scale(1.1)' }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: '20px 24px', gap: 20 }}>
                  <img
                    src={getMangaCover(selectedManga, '256')}
                    alt=""
                    style={{ width: 100, height: 140, objectFit: 'cover', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.6)', flexShrink: 0 }}
                  />
                  <div>
                    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 22, color: '#fff', marginBottom: 4 }}>
                      {getMangaTitle(selectedManga)}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{getMangaAuthor(selectedManga)}</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4, textTransform: 'capitalize' }}>
                      {selectedManga.attributes.status} | {selectedManga.attributes.publicationDemographic || 'Geral'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedManga(null)}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => handleReadOnline(selectedManga)}
                    disabled={chaptersLoading || readableVisibleChapters.length === 0}
                  >
                    Ler primeira versao do filtro
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleAddToLibrary(selectedManga)}
                    disabled={isInLibrary(selectedManga.id)}
                  >
                    <BookmarkPlus size={15} />
                    {isInLibrary(selectedManga.id) ? 'Na Biblioteca' : 'Adicionar'}
                  </button>
                </div>

                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sinopse</p>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'hsl(var(--foreground))', maxHeight: 110, overflow: 'auto' }}>
                    {getMangaDescription(selectedManga) || 'Sem descricao disponivel.'}
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedManga.attributes.tags
                    .filter((t) => t.attributes.group === 'genre')
                    .slice(0, 8)
                    .map((t) => (
                      <span key={t.id} className="badge badge-reading" style={{ fontSize: 10 }}>
                        {t.attributes.name.en}
                      </span>
                    ))}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Versoes {chaptersLoading ? '(carregando...)' : `(${readableVisibleChapters.length}/${chaptersData.length})`}
                    </p>
                    <select
                      className="input"
                      style={{ width: 190, fontSize: 12, padding: '6px 8px' }}
                      value={selectedLang}
                      onChange={(e) => chooseLanguage(e.target.value)}
                    >
                      {MANGADEX_LANGUAGE_FILTERS.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ maxHeight: 230, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {!chaptersLoading && readableVisibleChapters.length === 0 && (
                      <div style={{ padding: '14px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))', fontSize: 12, textAlign: 'center' }}>
                        Nenhuma versao legivel em {formatMangaDexLanguage(selectedLang)}.
                      </div>
                    )}
                    {readableVisibleChapters.map((chapter) => (
                      <button
                        key={chapter.id}
                        type="button"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13, color: 'hsl(var(--foreground))', background: 'transparent', textAlign: 'left' }}
                        onClick={async () => {
                          await handleReadOnline(selectedManga, chapter.id)
                          setSelectedManga(null)
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--secondary))')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatChapterOption(chapter)}
                        </span>
                        <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
                          {formatMangaDexLanguage(chapter.attributes.translatedLanguage)} | {chapter.attributes.pages} pags
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
