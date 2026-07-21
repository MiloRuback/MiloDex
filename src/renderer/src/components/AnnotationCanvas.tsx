import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { Annotation } from '../types/global'
import { generateId } from '../utils/helpers'

interface Props {
  annotations: Annotation[]
  mode: 'none' | 'text' | 'image'
  zoom: number
  onAdd: (annotation: Annotation) => void
  onUpdate: (annotation: Annotation) => void
  onDelete: (id: string) => void
}

interface DragState {
  annotId: string
  startX: number
  startY: number
  startAnnotX: number
  startAnnotY: number
}

export default function AnnotationCanvas({ annotations, mode, zoom, onAdd, onUpdate, onDelete }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [newTextPos, setNewTextPos] = useState<{ x: number; y: number } | null>(null)

  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    if (mode === 'none') {
      setSelected(null)
      return
    }
    e.stopPropagation()
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    if (mode === 'text') {
      setNewTextPos({ x, y })
      setEditText('')
    } else if (mode === 'image') {
      // Pick an image
      const imgData = await window.milodex.files.pickImage()
      if (!imgData) return
      const annotation: Annotation = {
        id: generateId(),
        manga_id: '',
        chapter_id: '',
        page_index: 0,
        type: 'image',
        x,
        y,
        width: 200,
        height: 200,
        image_path: imgData
      }
      onAdd(annotation)
    }
  }, [mode, zoom, onAdd])

  const handleTextConfirm = () => {
    if (!newTextPos || !editText.trim()) {
      setNewTextPos(null)
      return
    }
    const annotation: Annotation = {
      id: generateId(),
      manga_id: '',
      chapter_id: '',
      page_index: 0,
      type: 'text',
      x: newTextPos.x,
      y: newTextPos.y,
      width: Math.max(200, editText.length * 8),
      height: 40,
      content: editText,
      font_size: 14,
      font_color: '#ffffff',
      bg_color: 'rgba(0,0,0,0.7)'
    }
    onAdd(annotation)
    setNewTextPos(null)
    setEditText('')
  }

  const handleAnnotMouseDown = (e: React.MouseEvent, annotId: string) => {
    e.stopPropagation()
    setSelected(annotId)
    const annot = annotations.find((a) => a.id === annotId)!
    setDragging({
      annotId,
      startX: e.clientX,
      startY: e.clientY,
      startAnnotX: annot.x,
      startAnnotY: annot.y
    })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return
    const dx = (e.clientX - dragging.startX) / zoom
    const dy = (e.clientY - dragging.startY) / zoom
    const annot = annotations.find((a) => a.id === dragging.annotId)
    if (!annot) return
    onUpdate({ ...annot, x: dragging.startAnnotX + dx, y: dragging.startAnnotY + dy })
  }, [dragging, zoom, annotations, onUpdate])

  const handleMouseUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: mode !== 'none' || annotations.length > 0 ? 'auto' : 'none',
        cursor: mode === 'text' ? 'text' : mode === 'image' ? 'cell' : 'default',
        zIndex: 20
      }}
      onClick={handleCanvasClick}
    >
      {/* Render annotations */}
      {annotations.map((annot) => {
        const isSelected = selected === annot.id
        return (
          <div
            key={annot.id}
            style={{
              position: 'absolute',
              left: annot.x * zoom,
              top: annot.y * zoom,
              width: (annot.width || 200) * zoom,
              minHeight: (annot.height || 40) * zoom,
              cursor: 'move',
              outline: isSelected ? '2px solid #a78bfa' : 'none',
              borderRadius: 6,
              zIndex: annot.z_index || 1,
              userSelect: 'none'
            }}
            onMouseDown={(e) => handleAnnotMouseDown(e, annot.id)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (annot.type === 'text') {
                setEditing(annot.id)
                setEditText(annot.content || '')
              }
            }}
          >
            {annot.type === 'text' ? (
              editing === annot.id ? (
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => {
                    onUpdate({ ...annot, content: editText })
                    setEditing(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setEditing(null)
                    } else if (e.key === 'Enter' && e.ctrlKey) {
                      onUpdate({ ...annot, content: editText })
                      setEditing(null)
                    }
                  }}
                  style={{
                    width: '100%',
                    minHeight: 40,
                    background: annot.bg_color || 'rgba(0,0,0,0.7)',
                    color: annot.font_color || '#ffffff',
                    border: '1px solid #a78bfa',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: (annot.font_size || 14) * zoom,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    resize: 'both',
                    cursor: 'text'
                  }}
                />
              ) : (
                <div
                  style={{
                    background: annot.bg_color || 'rgba(0,0,0,0.7)',
                    color: annot.font_color || '#ffffff',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: (annot.font_size || 14) * zoom,
                    fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    backdropFilter: 'blur(2px)'
                  }}
                >
                  {annot.content || '...'}
                </div>
              )
            ) : (
              <img
                src={annot.image_path}
                alt="annotation"
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 6,
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* Delete button */}
            {isSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(annot.id)
                  setSelected(null)
                }}
                style={{
                  position: 'absolute',
                  top: -12,
                  right: -12,
                  background: 'hsl(0 83% 40%)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}
                title="Remover anotação"
              >✕</button>
            )}
          </div>
        )
      })}

      {/* New text input popup */}
      {newTextPos && (
        <div
          style={{
            position: 'absolute',
            left: newTextPos.x * zoom,
            top: newTextPos.y * zoom,
            zIndex: 100,
            background: 'rgba(0,0,0,0.9)',
            border: '1px solid #a78bfa',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 220,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type="text"
            className="input"
            placeholder="Digite sua anotação..."
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextConfirm()
              if (e.key === 'Escape') setNewTextPos(null)
            }}
            style={{ background: 'rgba(255,255,255,0.08)', fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setNewTextPos(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={handleTextConfirm}>
              Adicionar
            </button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>Enter para confirmar · Esc para cancelar</p>
        </div>
      )}
    </div>
  )
}
