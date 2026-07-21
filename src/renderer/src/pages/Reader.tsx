import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Type, ImageIcon, Move, Trash2, Layers, AlignJustify,
  RotateCcw, Columns, Download, Maximize2, X, Check
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type { Annotation, LibraryEntry, MangaDexChapter } from '../types/global'
import { generateId } from '../utils/helpers'
import AnnotationCanvas from '../components/AnnotationCanvas'

type ReadMode = 'rtl' | 'ltr' | 'scroll'
type PageView = 'single' | 'double'

export default function Reader() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast, readMode: globalReadMode, pageView: globalPageView, setReadMode, setPageView } = useAppStore()

  // Manga data
  const [manga, setManga] = useState<LibraryEntry | null>(null)
  const [pages, setPages] = useState<string[]>([])
  const [chapters, setChapters] = useState<MangaDexChapter[]>([])
  const [currentChapter, setCurrentChapter] = useState<string>('')
  const [parsedType, setParsedType] = useState<'images' | 'html' | 'pdf' | 'epub' | null>(null)
  const [htmlContent, setHtmlContent] = useState<string>('')

  // Reader state
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1.0)
  const [readMode, setLocalReadMode] = useState<ReadMode>(globalReadMode)
  const [pageView, setLocalPageView] = useState<PageView>(globalPageView)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uiVisible, setUiVisible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Annotation state
  const [annotMode, setAnnotMode] = useState<'none' | 'text' | 'image'>('none')
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // UI hide timer
  const uiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Load Manga ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    loadManga()
  }, [id])

  const loadManga = async () => {
    if (!id) return
    setLoading(true)
    setError(null)

    try {
      const mangaData = await window.milodex.library.getById(id)
      if (!mangaData) {
        setError('Mangá não encontrado na biblioteca.')
        return
      }
      setManga(mangaData as LibraryEntry)

      // Restore progress
      const history = await window.milodex.history.get(id)
      if (history) {
        setCurrentPage(history.page_index || 0)
        setZoom(history.zoom_level || 1.0)
        setLocalReadMode((history.read_mode as ReadMode) || 'rtl')
      }

      // Check for ?chapter= query param
      const chapterParam = searchParams.get('chapter')

      if (mangaData.source === 'local' && mangaData.file_path) {
        await loadLocalFile(mangaData.file_path)
      } else if (mangaData.source === 'mangadex' && mangaData.mangadex_id) {
        await loadMangaDexChapters(mangaData.mangadex_id, chapterParam || history?.chapter_id || '')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar o mangá.')
    } finally {
      setLoading(false)
    }
  }

  const loadLocalFile = async (filePath: string) => {
    const result = await window.milodex.files.parse(filePath)
    if (result.type === 'error') {
      setError(result.error || 'Erro ao processar arquivo')
      return
    }
    setParsedType(result.type as any)
    if (result.type === 'images' && result.pages) {
      setPages(result.pages)
    } else if (result.type === 'html' && result.html) {
      setHtmlContent(result.html)
    }
  }

  const loadMangaDexChapters = async (mangadexId: string, initialChapterId?: string) => {
    const res = await window.milodex.mangadex.getChapters(mangadexId, 'pt-br', 500, 0)
    const chapterList: MangaDexChapter[] = res.data || []
    setChapters(chapterList)

    const targetId = initialChapterId || chapterList[0]?.id
    if (targetId) {
      await loadChapterImages(targetId)
    }
  }

  const loadChapterImages = async (chapterId: string) => {
    setLoading(true)
    setCurrentChapter(chapterId)
    try {
      const { pages: imgPages } = await window.milodex.mangadex.getChapterImages(chapterId)
      setPages(imgPages)
      setCurrentPage(0)
      setParsedType('images')
      // Load annotations for this chapter
      if (id) await loadAnnotations(chapterId, 0)
    } catch (err: any) {
      showToast({ message: 'Erro ao carregar imagens do capítulo', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // ─── Annotations ───────────────────────────────────────────────────────────
  const loadAnnotations = async (chapterId: string, pageIdx: number) => {
    if (!id) return
    const data = await window.milodex.annotations.get(id, chapterId || 'local', pageIdx)
    setAnnotations(data as Annotation[])
  }

  const handleAnnotationAdd = async (annotation: Annotation) => {
    const chId = currentChapter || (manga?.file_path ? 'local' : 'unknown')
    const finalAnnot: Annotation = { ...annotation, manga_id: id!, chapter_id: chId, page_index: currentPage }
    await window.milodex.annotations.save(finalAnnot)
    setAnnotations((prev) => [...prev, finalAnnot])
    setAnnotMode('none')
  }

  const handleAnnotationUpdate = async (annotation: Annotation) => {
    await window.milodex.annotations.save(annotation)
    setAnnotations((prev) => prev.map((a) => (a.id === annotation.id ? annotation : a)))
  }

  const handleAnnotationDelete = async (annotId: string) => {
    await window.milodex.annotations.delete(annotId)
    setAnnotations((prev) => prev.filter((a) => a.id !== annotId))
  }

  // ─── Page Navigation ──────────────────────────────────────────────────────
  const goToPage = useCallback(async (pageIdx: number) => {
    const clamped = Math.max(0, Math.min(pageIdx, pages.length - 1))
    setCurrentPage(clamped)
    setPan({ x: 0, y: 0 })
    // Save progress
    if (id) {
      await window.milodex.history.save({
        manga_id: id,
        chapter_id: currentChapter,
        page_index: clamped,
        total_pages: pages.length,
        zoom_level: zoom,
        read_mode: readMode
      })
    }
    // Load annotations for new page
    await loadAnnotations(currentChapter, clamped)
  }, [id, pages.length, currentChapter, zoom, readMode])

  const nextPage = useCallback(() => {
    if (pageView === 'double') goToPage(currentPage + 2)
    else goToPage(currentPage + 1)
  }, [currentPage, pageView, goToPage])

  const prevPage = useCallback(() => {
    if (pageView === 'double') goToPage(currentPage - 2)
    else goToPage(currentPage - 1)
  }, [currentPage, pageView, goToPage])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        readMode === 'rtl' ? prevPage() : nextPage()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        readMode === 'rtl' ? nextPage() : prevPage()
      } else if (e.key === 'Escape') {
        navigate(-1)
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.25, 4))
      } else if (e.key === '-') {
        setZoom((z) => Math.max(z - 0.25, 0.5))
      } else if (e.key === '0') {
        setZoom(1); setPan({ x: 0, y: 0 })
      } else if (e.key === 'F11') {
        e.preventDefault()
        window.milodex.window.fullscreen()
        setIsFullscreen((f) => !f)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [readMode, nextPage, prevPage])

  // ─── Mouse UI hide ──────────────────────────────────────────────────────────
  const resetUiTimer = useCallback(() => {
    setUiVisible(true)
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current)
    uiTimerRef.current = setTimeout(() => setUiVisible(false), 2500)
  }, [])

  useEffect(() => {
    resetUiTimer()
    return () => { if (uiTimerRef.current) clearTimeout(uiTimerRef.current) }
  }, [currentPage])

  // ─── Scroll navigation ─────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (readMode !== 'scroll') {
      e.preventDefault()
      if (e.deltaY > 0) nextPage()
      else prevPage()
    }
  }, [readMode, nextPage, prevPage])

  // ─── Click to navigate ─────────────────────────────────────────────────────
  const handlePageClick = useCallback((e: React.MouseEvent) => {
    if (annotMode !== 'none') return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const clickX = e.clientX - rect.left
    if (clickX < rect.width / 2) {
      readMode === 'rtl' ? nextPage() : prevPage()
    } else {
      readMode === 'rtl' ? prevPage() : nextPage()
    }
  }, [readMode, nextPage, prevPage, annotMode])

  // ─── Download Chapter ──────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!currentChapter || !manga) return
    const ch = chapters.find((c) => c.id === currentChapter)
    showToast({ message: 'Iniciando download do capítulo...', type: 'info' })
    const result = await window.milodex.mangadex.downloadChapter(
      currentChapter,
      manga.title,
      ch?.attributes.chapter || '0'
    )
    if (result.success) {
      showToast({ message: `Capítulo salvo como CBZ em ${result.path}`, type: 'success' })
    } else {
      showToast({ message: result.error || 'Erro no download', type: 'error' })
    }
  }

  // ─── Render Pages ──────────────────────────────────────────────────────────
  const renderPages = () => {
    if (parsedType === 'html') {
      return (
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none', background: '#0f0f14' }}
          title="book-content"
        />
      )
    }

    if (parsedType === 'pdf') {
      return (
        <div style={{ color: '#fff', padding: 32, textAlign: 'center' }}>
          <p>PDF: Use o leitor externo — funcionalidade em desenvolvimento.</p>
        </div>
      )
    }

    if (pageView === 'double' && pages.length > 1) {
      const leftIdx = readMode === 'rtl' ? currentPage + 1 : currentPage
      const rightIdx = readMode === 'rtl' ? currentPage : currentPage + 1
      return (
        <div
          style={{ display: 'flex', gap: 4, height: '100%', width: '100%', justifyContent: 'center', alignItems: 'center', transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'center center', transition: 'transform 0.1s ease' }}
          onClick={handlePageClick}
        >
          {pages[leftIdx] && (
            <img src={pages[leftIdx]} alt={`Page ${leftIdx + 1}`} style={{ maxHeight: '100%', maxWidth: '50%', objectFit: 'contain' }} />
          )}
          {pages[rightIdx] && (
            <img src={pages[rightIdx]} alt={`Page ${rightIdx + 1}`} style={{ maxHeight: '100%', maxWidth: '50%', objectFit: 'contain' }} />
          )}
        </div>
      )
    }

    if (readMode === 'scroll') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
          {pages.map((src, i) => (
            <img key={i} src={src} alt={`Page ${i + 1}`} style={{ width: `${zoom * 100}%`, maxWidth: '100%', display: 'block' }} loading="lazy" />
          ))}
        </div>
      )
    }

    // Single page
    return pages[currentPage] ? (
      <div
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: annotMode !== 'none' ? 'crosshair' : 'pointer' }}
        onClick={handlePageClick}
      >
        <img
          src={pages[currentPage]}
          alt={`Page ${currentPage + 1}`}
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        />
      </div>
    ) : null
  }

  // ─── Loading / Error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: '#000', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '3px solid rgba(167,139,250,0.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Carregando...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: '#000', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff' }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <p style={{ fontWeight: 600 }}>Erro ao carregar</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, maxWidth: 300, textAlign: 'center' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Voltar</button>
      </div>
    )
  }

  const currentChapterObj = chapters.find((c) => c.id === currentChapter)
  const currentChapterIdx = chapters.findIndex((c) => c.id === currentChapter)

  return (
    <div
      className="reader-container"
      ref={containerRef}
      onMouseMove={resetUiTimer}
      onWheel={readMode !== 'scroll' ? handleWheel : undefined}
    >
      {/* ─── Top Floating Bar ─── */}
      <div className={`reader-floating-top ${uiVisible ? '' : 'reader-hidden'}`}>
        {/* Back button */}
        <button className="reader-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          <span style={{ fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {manga?.title || 'Voltar'}
          </span>
        </button>

        {currentChapterObj && (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, flex: 1, textAlign: 'center' }}>
            Capítulo {currentChapterObj.attributes.chapter || '—'}
            {currentChapterObj.attributes.title ? ` — ${currentChapterObj.attributes.title}` : ''}
          </span>
        )}

        {/* Annotation Tools */}
        <div className="annotation-toolbar">
          <button
            className={`reader-btn ${annotMode === 'text' ? 'active' : ''}`}
            onClick={() => setAnnotMode(annotMode === 'text' ? 'none' : 'text')}
            title="Adicionar texto (anotação)"
          >
            <Type size={14} />
          </button>
          <button
            className={`reader-btn ${annotMode === 'image' ? 'active' : ''}`}
            onClick={() => setAnnotMode(annotMode === 'image' ? 'none' : 'image')}
            title="Adicionar imagem (sticker)"
          >
            <ImageIcon size={14} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="annotation-toolbar">
          <button className="reader-btn" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} title="Diminuir zoom">
            <ZoomOut size={14} />
          </button>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, minWidth: 38, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="reader-btn" onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} title="Aumentar zoom">
            <ZoomIn size={14} />
          </button>
          <button className="reader-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="Resetar zoom">
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Read Mode */}
        <div className="annotation-toolbar">
          <button
            className={`reader-btn ${readMode === 'rtl' ? 'active' : ''}`}
            onClick={() => { setLocalReadMode('rtl'); setReadMode('rtl') }}
            title="RTL (Mangá)"
          >
            RTL
          </button>
          <button
            className={`reader-btn ${readMode === 'ltr' ? 'active' : ''}`}
            onClick={() => { setLocalReadMode('ltr'); setReadMode('ltr') }}
            title="LTR (Quadrinhos)"
          >
            LTR
          </button>
          <button
            className={`reader-btn ${readMode === 'scroll' ? 'active' : ''}`}
            onClick={() => { setLocalReadMode('scroll'); setReadMode('scroll') }}
            title="Scroll vertical (Webtoon)"
          >
            <AlignJustify size={12} />
          </button>
          <button
            className={`reader-btn ${pageView === 'double' ? 'active' : ''}`}
            onClick={() => {
              const newView = pageView === 'single' ? 'double' : 'single'
              setLocalPageView(newView)
              setPageView(newView)
            }}
            title="Página dupla"
          >
            <Columns size={12} />
          </button>
        </div>

        {/* Fullscreen + Download */}
        {manga?.source === 'mangadex' && (
          <button className="reader-btn" onClick={handleDownload} title="Baixar capítulo como CBZ">
            <Download size={14} />
          </button>
        )}
        <button className="reader-btn" onClick={() => window.milodex.window.fullscreen()} title="Tela cheia (F11)">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* ─── Main Page Area ─── */}
      <div style={{ flex: 1, position: 'relative', overflow: readMode === 'scroll' ? 'auto' : 'hidden' }}>
        {renderPages()}

        {/* Annotation Canvas Overlay */}
        {parsedType === 'images' && readMode !== 'scroll' && (
          <AnnotationCanvas
            annotations={annotations}
            mode={annotMode}
            zoom={zoom}
            onAdd={handleAnnotationAdd}
            onUpdate={handleAnnotationUpdate}
            onDelete={handleAnnotationDelete}
          />
        )}
      </div>

      {/* ─── Navigation Arrows (visible while hovering) ─── */}
      {readMode !== 'scroll' && parsedType === 'images' && (
        <>
          <button
            className={`reader-btn ${uiVisible ? '' : 'reader-hidden'}`}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 40, padding: '12px 10px' }}
            onClick={readMode === 'rtl' ? nextPage : prevPage}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className={`reader-btn ${uiVisible ? '' : 'reader-hidden'}`}
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 40, padding: '12px 10px' }}
            onClick={readMode === 'rtl' ? prevPage : nextPage}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* ─── Bottom Bar ─── */}
      {parsedType === 'images' && readMode !== 'scroll' && (
        <div className={`reader-floating-bottom ${uiVisible ? '' : 'reader-hidden'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, minWidth: 60, textAlign: 'right' }}>
              {currentPage + 1} / {pages.length}
            </span>
            <input
              type="range"
              className="page-slider"
              min={0}
              max={Math.max(0, pages.length - 1)}
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, minWidth: 60 }}>
              {pages.length > 0 ? Math.round((currentPage / (pages.length - 1)) * 100) : 0}%
            </span>
          </div>

          {/* Chapter navigation (MangaDex) */}
          {chapters.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
              <button
                className="reader-btn"
                disabled={currentChapterIdx <= 0}
                onClick={() => {
                  const prev = chapters[currentChapterIdx - 1]
                  if (prev) loadChapterImages(prev.id)
                }}
              >
                <ChevronLeft size={13} /> Cap. anterior
              </button>
              <select
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', maxWidth: 200 }}
                value={currentChapter}
                onChange={(e) => loadChapterImages(e.target.value)}
              >
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Cap. {ch.attributes.chapter || 'Oneshot'}
                    {ch.attributes.title ? ` — ${ch.attributes.title}` : ''}
                  </option>
                ))}
              </select>
              <button
                className="reader-btn"
                disabled={currentChapterIdx >= chapters.length - 1}
                onClick={() => {
                  const next = chapters[currentChapterIdx + 1]
                  if (next) loadChapterImages(next.id)
                }}
              >
                Próx. cap. <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
