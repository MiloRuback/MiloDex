import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import type { LibraryEntry, HistoryEntry } from '../types/global'
import { STATUS_LABELS, STATUS_CLASSES, calcProgress } from '../utils/helpers'

interface MangaCardProps {
  manga: LibraryEntry
  history?: HistoryEntry | null
  size?: 'sm' | 'md' | 'lg'
  showStatus?: boolean
  onClick?: () => void
}

export default function MangaCard({ manga, history, size = 'md', showStatus = true, onClick }: MangaCardProps) {
  const navigate = useNavigate()

  const progress = history
    ? calcProgress(history.page_index || 0, history.total_pages || 0)
    : 0

  const coverSrc = manga.cover_url || manga.cover_local || ''

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate(`/reader/${manga.id}`)
    }
  }

  return (
    <motion.div
      className="manga-card"
      onClick={handleClick}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Cover */}
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={manga.title}
          className="manga-card-cover"
          loading="lazy"
          onError={(e) => {
            const t = e.target as HTMLImageElement
            t.style.display = 'none'
          }}
        />
      ) : (
        <div
          className="manga-card-cover"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: 36, opacity: 0.4 }}>📚</span>
        </div>
      )}

      {/* Overlay */}
      <div className="manga-card-overlay">
        <p className="manga-card-title">{manga.title}</p>
        <div className="manga-card-progress">
          <div
            className="manga-card-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status Badge */}
      {showStatus && (
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span className={`badge ${STATUS_CLASSES[manga.status] || 'badge-reading'}`}>
            {STATUS_LABELS[manga.status] || manga.status}
          </span>
        </div>
      )}

      {/* Play button on hover */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: '50%',
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s'
        }}
        className="play-btn-hover"
      >
        <Play size={20} fill="white" color="white" />
      </div>
    </motion.div>
  )
}
