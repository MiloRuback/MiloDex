import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, BookOpen, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type { MangaDexManga } from '../types/global'
import { getMangaCover, getMangaTitle } from '../utils/helpers'

export default function Home() {
  const navigate = useNavigate()
  const { library, recentHistory, fetchRecentHistory } = useAppStore()
  const [trending, setTrending] = useState<MangaDexManga[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)

  useEffect(() => {
    fetchRecentHistory()
    loadTrending()
  }, [])

  const loadTrending = async () => {
    try {
      setTrendingLoading(true)
      const res = await window.milodex.mangadex.getTrending()
      setTrending(res.data || [])
    } catch {
      setTrending([])
    } finally {
      setTrendingLoading(false)
    }
  }

  const continueReading = recentHistory.slice(0, 10)

  const getLibraryEntry = (mangaId: string) => library.find((l) => l.id === mangaId)

  return (
    <div style={{ padding: '28px 32px 32px', animation: 'fadeIn 0.35s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">Início</h1>
        <p className="page-subtitle">Bem-vindo ao MiloDex — sua biblioteca de leitura premium</p>
      </div>

      {/* Continue Reading */}
      {continueReading.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={18} color="hsl(262 83% 68%)" />
              <h2 className="section-title">Continuar Lendo</h2>
            </div>
            <span className="section-action" onClick={() => navigate('/library')}>
              Ver tudo <ChevronRight size={14} style={{ display: 'inline' }} />
            </span>
          </div>
          <div className="continue-scroll stagger-children">
            {continueReading.map((h) => {
              const lib = getLibraryEntry(h.manga_id)
              if (!lib) return null
              const progress = h.total_pages ? Math.round(((h.page_index || 0) / h.total_pages) * 100) : 0
              return (
                <div
                  key={h.manga_id}
                  className="continue-card"
                  onClick={() => navigate(`/reader/${h.manga_id}`)}
                >
                  {lib.cover_url || lib.cover_local ? (
                    <img
                      src={lib.cover_url || lib.cover_local}
                      alt={lib.title}
                      style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%', aspectRatio: '2/3',
                        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32
                      }}
                    >📚</div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)',
                    padding: '30px 10px 10px'
                  }}>
                    <p style={{ fontSize: 11.5, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}
                      className="line-clamp-2"
                    >
                      {lib.title}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                        {h.chapter_number ? `Cap. ${h.chapter_number}` : `Pág. ${(h.page_index || 0) + 1}`}
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{progress}%</span>
                    </div>
                    <div style={{ height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 999 }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #0ea5e9)', borderRadius: 999 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Trending on MangaDex */}
      <section>
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="hsl(262 83% 68%)" />
            <h2 className="section-title">Destaques no MangaDex</h2>
          </div>
          <span className="section-action" onClick={() => navigate('/search')}>
            Explorar <ChevronRight size={14} style={{ display: 'inline' }} />
          </span>
        </div>

        {trendingLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {Array(6).fill(0).map((_, i) => (
              <div key={i}>
                <div className="shimmer" style={{ aspectRatio: '2/3', borderRadius: 12, marginBottom: 8 }} />
                <div className="shimmer" style={{ height: 12, borderRadius: 6, marginBottom: 6, width: '85%' }} />
                <div className="shimmer" style={{ height: 10, borderRadius: 6, width: '55%' }} />
              </div>
            ))}
          </div>
        ) : trending.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🌐</div>
            <p className="empty-state-title">Sem conexão com MangaDex</p>
            <p className="empty-state-desc">Verifique sua conexão com a internet para ver os destaques.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={loadTrending}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="manga-grid stagger-children" style={{ padding: 0 }}>
            {trending.map((manga) => (
              <motion.div
                key={manga.id}
                className="manga-card"
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
                onClick={() => navigate(`/search?manga=${manga.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <img
                  src={getMangaCover(manga)}
                  alt={getMangaTitle(manga)}
                  className="manga-card-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div className="manga-card-overlay">
                  <p className="manga-card-title">{getMangaTitle(manga)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Library empty call-to-action */}
      {library.length === 0 && continueReading.length === 0 && (
        <div style={{
          marginTop: 32,
          padding: 32,
          borderRadius: 16,
          border: '1px dashed hsl(var(--border))',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Sua biblioteca está vazia</h3>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13, marginBottom: 20 }}>
            Importe arquivos locais ou adicione mangás do MangaDex para começar a ler.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/search')}>
              Buscar Mangás
            </button>
            <button className="btn btn-secondary" onClick={async () => {
              const paths = await window.milodex.files.openPicker()
              if (paths.length > 0) navigate('/local')
            }}>
              Importar Arquivo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
