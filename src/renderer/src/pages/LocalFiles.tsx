import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, File, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { formatFileSize } from '../utils/helpers'

export default function LocalFiles() {
  const navigate = useNavigate()
  const { library, fetchLibrary, showToast } = useAppStore()
  const [dragging, setDragging] = useState(false)

  const localFiles = library.filter((m) => m.source === 'local')

  const handleImport = async () => {
    const paths = await window.milodex.files.openPicker()
    if (!paths || paths.length === 0) return
    for (const filePath of paths) {
      const meta = await window.milodex.files.getMetadata(filePath)
      if (!meta) continue
      await window.milodex.library.add({
        id: `local-${filePath.replace(/\W/g, '_')}`,
        title: meta.name,
        type: meta.ext === '.cbz' || meta.ext === '.cbr' ? 'manga' : 'book',
        source: 'local',
        status: 'reading',
        file_path: filePath,
        tags: JSON.stringify([meta.ext.replace('.', '')])
      })
    }
    await fetchLibrary()
    showToast({ message: `${paths.length} arquivo(s) importado(s)!`, type: 'success' })
  }

  const handleRemove = async (id: string) => {
    await window.milodex.library.remove(id)
    await fetchLibrary()
    showToast({ message: 'Arquivo removido da biblioteca', type: 'info' })
  }

  const getFileIcon = (ext: string): string => {
    const icons: Record<string, string> = {
      cbz: '📦', cbr: '📦', epub: '📗', pdf: '📕',
      txt: '📄', docx: '📝', doc: '📝', html: '🌐', htm: '🌐'
    }
    return icons[ext.replace('.', '').toLowerCase()] || '📄'
  }

  return (
    <div style={{ padding: '28px 32px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Arquivos Locais</h1>
          <p className="page-subtitle">Gerencie seus arquivos locais · {localFiles.length} arquivo(s)</p>
        </div>
        <button className="btn btn-primary" onClick={handleImport}>
          <Plus size={15} />
          Importar Arquivo
        </button>
      </div>

      {/* Drag & Drop Area */}
      <div
        style={{
          border: `2px dashed ${dragging ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
          borderRadius: 16,
          padding: '32px 20px',
          textAlign: 'center',
          marginBottom: 28,
          background: dragging ? 'hsl(var(--primary) / 0.05)' : 'transparent',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onClick={handleImport}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragging(false)
          const paths = Array.from(e.dataTransfer.files).map((f) => f.path).filter(Boolean) as string[]
          for (const filePath of paths) {
            const meta = await window.milodex.files.getMetadata(filePath)
            if (!meta) continue
            await window.milodex.library.add({
              id: `local-${filePath.replace(/\W/g, '_')}`,
              title: meta.name,
              type: meta.ext === '.cbz' || meta.ext === '.cbr' ? 'manga' : 'book',
              source: 'local',
              status: 'reading',
              file_path: filePath,
              tags: JSON.stringify([meta.ext.replace('.', '')])
            })
          }
          if (paths.length > 0) {
            await fetchLibrary()
            showToast({ message: `${paths.length} arquivo(s) importado(s)!`, type: 'success' })
          }
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Arraste arquivos aqui ou clique para selecionar</p>
        <p style={{ fontSize: 12.5, color: 'hsl(var(--muted-foreground))' }}>
          Suporta: CBZ, CBR, EPUB, PDF, TXT, HTML, DOCX, DOC
        </p>
      </div>

      {/* File List */}
      {localFiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <p className="empty-state-title">Nenhum arquivo local</p>
          <p className="empty-state-desc">Importe seus arquivos CBZ, PDF, EPUB e outros formatos para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {localFiles.map((file) => {
            const tags = JSON.parse(file.tags || '[]') as string[]
            const ext = tags[0] || ''
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onClick={() => navigate(`/reader/${file.id}`)}
                whileHover={{ x: 2 }}
              >
                <span style={{ fontSize: 28 }}>{getFileIcon(ext)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{file.title}</p>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.file_path}
                  </p>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 999, background: 'hsl(var(--secondary))', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
                  .{ext}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(file.id) }}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'hsl(0 83% 62%)' }}
                  title="Remover"
                >
                  <Trash2 size={15} />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
