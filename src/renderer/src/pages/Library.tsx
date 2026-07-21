import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Grid, List, Trash2, MoreVertical } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import MangaCard from '../components/MangaCard'
import { STATUS_LABELS } from '../utils/helpers'

const STATUSES = ['all', 'reading', 'completed', 'planned', 'paused', 'dropped']

export default function Library() {
  const navigate = useNavigate()
  const { library, fetchLibrary, showToast, recentHistory } = useAppStore()
  const [activeStatus, setActiveStatus] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  useEffect(() => {
    fetchLibrary()
  }, [])

  const filtered = activeStatus === 'all'
    ? library
    : library.filter((m) => m.status === activeStatus)

  const getHistory = (mangaId: string) => recentHistory.find((h) => h.manga_id === mangaId)

  const handleRemove = async (id: string) => {
    await window.milodex.library.remove(id)
    await fetchLibrary()
    showToast({ message: 'Removido da biblioteca', type: 'info' })
    setContextMenu(null)
  }

  const handleStatusChange = async (id: string, status: string) => {
    await window.milodex.library.updateStatus(id, status)
    await fetchLibrary()
    showToast({ message: `Status atualizado para "${STATUS_LABELS[status]}"`, type: 'success' })
    setContextMenu(null)
  }

  return (
    <div onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 className="page-title">Biblioteca</h1>
            <p className="page-subtitle">{library.length} item(s) na sua coleção</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn btn-ghost ${viewMode === 'grid' ? 'btn-secondary' : ''}`}
              onClick={() => setViewMode('grid')}
              style={{ padding: '8px 10px' }}
            >
              <Grid size={16} />
            </button>
            <button
              className={`btn btn-ghost ${viewMode === 'list' ? 'btn-secondary' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ padding: '8px 10px' }}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 20 }}>
          {STATUSES.map((status) => (
            <button
              key={status}
              className={`filter-chip ${activeStatus === status ? 'active' : ''}`}
              onClick={() => setActiveStatus(status)}
            >
              {status === 'all' ? 'Todos' : STATUS_LABELS[status]}
              <span style={{ opacity: 0.6, marginLeft: 4, fontSize: 11 }}>
                {status === 'all'
                  ? library.length
                  : library.filter((m) => m.status === status).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="empty-state animate-fade-in">
          <div className="empty-state-icon">📚</div>
          <p className="empty-state-title">Nenhum item encontrado</p>
          <p className="empty-state-desc">
            {activeStatus === 'all'
              ? 'Sua biblioteca está vazia. Importe arquivos ou busque mangás no MangaDex.'
              : `Você não tem itens com status "${STATUS_LABELS[activeStatus]}".`}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="manga-grid stagger-children" style={{ paddingTop: 4 }}>
          {filtered.map((manga) => (
            <div key={manga.id} style={{ position: 'relative' }}>
              <MangaCard
                manga={manga}
                history={getHistory(manga.id)}
                onClick={() => navigate(`/reader/${manga.id}`)}
              />
              {/* Context menu trigger */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setContextMenu({ id: manga.id, x: e.clientX, y: e.clientY })
                }}
                style={{
                  position: 'absolute', top: 8, right: 8, zIndex: 10,
                  background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: 4, cursor: 'pointer', color: 'white',
                  backdropFilter: 'blur(4px)', display: 'flex'
                }}
              >
                <MoreVertical size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '8px 32px 32px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map((manga) => {
            const h = getHistory(manga.id)
            const progress = h?.total_pages ? Math.round(((h.page_index || 0) / h.total_pages) * 100) : 0
            return (
              <motion.div
                key={manga.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="sidebar-item"
                style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', gap: 14 }}
                onClick={() => navigate(`/reader/${manga.id}`)}
                whileHover={{ x: 2 }}
              >
                {(manga.cover_url || manga.cover_local) ? (
                  <img
                    src={manga.cover_url || manga.cover_local}
                    alt={manga.title}
                    style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 40, height: 56, background: '#1e1b4b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📚</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 3 }}>{manga.title}</p>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                    {manga.author || 'Autor desconhecido'} · {STATUS_LABELS[manga.status]}
                    {h?.chapter_number ? ` · Cap. ${h.chapter_number}` : ''}
                  </p>
                  <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 999 }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #0ea5e9)', borderRadius: 999 }} />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setContextMenu({ id: manga.id, x: e.clientX, y: e.clientY })
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 4 }}
                >
                  <MoreVertical size={16} />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 100,
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 10,
            padding: '6px',
            minWidth: 180,
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            animation: 'scaleIn 0.15s ease'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ padding: '6px 10px', fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alterar Status</p>
          {['reading', 'completed', 'planned', 'paused', 'dropped'].map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(contextMenu.id, s)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'hsl(var(--foreground))', fontSize: 13, fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--secondary))')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
          <div className="divider" style={{ margin: '4px 0' }} />
          <button
            onClick={() => handleRemove(contextMenu.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'hsl(0 83% 62%)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(0 83% 18%)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <Trash2 size={13} style={{ marginRight: 6, display: 'inline' }} />
            Remover da Biblioteca
          </button>
        </div>
      )}
    </div>
  )
}
