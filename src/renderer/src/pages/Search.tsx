import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search as SearchIcon, X, Filter, Plus, BookmarkPlus } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type { MangaDexManga } from '../types/global'
import { getMangaCover, getMangaTitle, getMangaAuthor, getMangaDescription, generateId } from '../utils/helpers'

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

const LANGUAGES = [
  { value: 'pt-br', label: 'Português (BR)' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'es', label: 'Español' }
]

export default function Search() {
  const navigate = useNavigate()
  const { library, fetchLibrary, showToast } = useAppStore()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MangaDexManga[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedDemographic, setSelectedDemographic] = useState<string[]>([])
  const [selectedLang, setSelectedLang] = useState('pt-br')
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [selectedManga, setSelectedManga] = useState<MangaDexManga | null>(null)
  const [chaptersData, setChaptersData] = useState<any[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const LIMIT = 24

  const handleSearch = useCallback(async (q: string, off = 0) => {
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
    } catch (err) {
      showToast({ message: 'Erro ao buscar no MangaDex. Verifique sua conexão.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [selectedStatus, selectedDemographic, selectedLang])

  // Handle ?manga= param for direct manga view
  useEffect(() => {
    const mangaId = searchParams.get('manga')
    if (mangaId) {
      loadMangaDetails(mangaId)
    }
  }, [searchParams])

  const loadMangaDetails = async (id: string) => {
    try {
      const manga = await window.milodex.mangadex.getManga(id)
      setSelectedManga(manga)
      loadChapters(id)
    } catch {}
  }

  const loadChapters = async (mangaId: string) => {
    setChaptersLoading(true)
    try {
      const res = await window.milodex.mangadex.getChapters(mangaId, selectedLang, 100, 0)
      setChaptersData(res.data || [])
    } catch {
      setChaptersData([])
    } finally {
      setChaptersLoading(false)
    }
  }

  const isInLibrary = (mangaId: string) => library.some((l) => l.mangadex_id === mangaId)

  const handleAddToLibrary = async (manga: MangaDexManga) => {
    const cover = getMangaCover(manga, '512')
    await window.milodex.library.add({
      id: generateId(),
      title: getMangaTitle(manga),
      cover_url: cover,
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
    showToast({ message: `"${getMangaTitle(manga)}" adicionado à biblioteca!`, type: 'success' })
  }

  const handleReadOnline = async (manga: MangaDexManga) => {
    // Add to library first if not already there
    if (!isInLibrary(manga.id)) {
      await handleAddToLibrary(manga)
    }
    // Find library entry and navigate to reader
    const entry = library.find((l) => l.mangadex_id === manga.id)
    if (entry) {
      navigate(`/reader/${entry.id}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search Header */}
      <div className="page-header" style={{ paddingBottom: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 16 }}>Buscar no MangaDex</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <SearchIcon size={16} color="hsl(var(--muted-foreground))" />
            <input
              className="search-input"
              placeholder="Buscar mangás, autores, títulos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(query, 0) }}
              autoFocus
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>
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

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', marginTop: 12 }}
            >
              <div style={{ padding: '16px', background: 'hsl(var(--card))', borderRadius: 12, border: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--muted-foreground))' }}>STATUS</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        className={`filter-chip ${selectedStatus.includes(s.value) ? 'active' : ''}`}
                        onClick={() => setSelectedStatus(prev =>
                          prev.includes(s.value) ? prev.filter(x => x !== s.value) : [...prev, s.value]
                        )}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--muted-foreground))' }}>DEMOGRAFIA</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DEMOGRAPHICS.map((d) => (
                      <button
                        key={d.value}
                        className={`filter-chip ${selectedDemographic.includes(d.value) ? 'active' : ''}`}
                        onClick={() => setSelectedDemographic(prev =>
                          prev.includes(d.value) ? prev.filter(x => x !== d.value) : [...prev, d.value]
                        )}
                      >{d.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--muted-foreground))' }}>IDIOMA PREFERIDO</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.value}
                        className={`filter-chip ${selectedLang === l.value ? 'active' : ''}`}
                        onClick={() => setSelectedLang(l.value)}
                      >{l.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px 32px' }}>
        {results.length === 0 && !loading && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-title">Busque seu próximo mangá favorito</p>
            <p className="empty-state-desc">Digite um título, autor ou gênero para começar</p>
          </div>
        )}

        {loading && results.length === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {Array(12).fill(0).map((_, i) => (
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
              {total} resultados · exibindo {results.length}
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
                    onClick={() => setSelectedManga(manga)}
                  >
                    <img
                      src={getMangaCover(manga)}
                      alt={getMangaTitle(manga)}
                      className="manga-card-cover"
                      loading="lazy"
                    />
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

      {/* Manga Detail Modal */}
      <AnimatePresence>
        {selectedManga && (
          <div className="modal-overlay" onClick={() => setSelectedManga(null)}>
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}
            >
              {/* Hero */}
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
                      {selectedManga.attributes.status} · {selectedManga.attributes.publicationDemographic || 'Geral'}
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
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleReadOnline(selectedManga)}>
                    Ler Online
                  </button>
                  <button
                    className={`btn ${isInLibrary(selectedManga.id) ? 'btn-secondary' : 'btn-secondary'}`}
                    onClick={() => handleAddToLibrary(selectedManga)}
                    disabled={isInLibrary(selectedManga.id)}
                  >
                    <BookmarkPlus size={15} />
                    {isInLibrary(selectedManga.id) ? 'Na Biblioteca' : 'Adicionar'}
                  </button>
                </div>

                {/* Description */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sinopse</p>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'hsl(var(--foreground))', maxHeight: 120, overflow: 'auto' }}>
                    {getMangaDescription(selectedManga) || 'Sem descrição disponível.'}
                  </p>
                </div>

                {/* Tags */}
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

                {/* Chapters */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Capítulos {chaptersLoading ? '(carregando...)' : `(${chaptersData.length})`}
                  </p>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {chaptersData.map((ch: any) => (
                      <div
                        key={ch.id}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}
                        onClick={async () => {
                          // Ensure in library, then go to reader with this chapter
                          if (!isInLibrary(selectedManga.id)) await handleAddToLibrary(selectedManga)
                          await fetchLibrary()
                          // Navigate to reader
                          const updatedLib = await window.milodex.library.getAll()
                          const entry = updatedLib.find((l: any) => l.mangadex_id === selectedManga.id)
                          if (entry) navigate(`/reader/${entry.id}?chapter=${ch.id}`)
                          setSelectedManga(null)
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--secondary))')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {ch.attributes.chapter ? `Capítulo ${ch.attributes.chapter}` : 'Oneshot'}
                          {ch.attributes.title ? ` — ${ch.attributes.title}` : ''}
                        </span>
                        <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                          {ch.attributes.pages} págs · {ch.attributes.translatedLanguage.toUpperCase()}
                        </span>
                      </div>
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
