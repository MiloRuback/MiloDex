import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlignJustify,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns,
  Download,
  ImageIcon,
  Maximize2,
  RotateCcw,
  Type,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import AnnotationCanvas from '../components/AnnotationCanvas'
import { useAppStore } from '../store/appStore'
import type { Annotation, LibraryEntry, MangaDexChapter } from '../types/global'
import {
  MANGADEX_LANGUAGE_FILTERS,
  formatChapterOption,
  isReadableChapter,
  sortMangaDexChapters
} from '../utils/helpers'

type ReadMode = 'rtl' | 'ltr' | 'scroll'
type PageView = 'single' | 'double'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
const clampZoom = (value: number) => clamp(value, 0.5, 5)

export default function Reader() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    showToast,
    settings,
    updateSetting,
    readMode: globalReadMode,
    pageView: globalPageView,
    setReadMode,
    setPageView
  } = useAppStore()

  const [manga, setManga] = useState<LibraryEntry | null>(null)
  const [pages, setPages] = useState<string[]>([])
  const [chapterFallbackPages, setChapterFallbackPages] = useState<Record<number, string>>({})
  const [pageErrors, setPageErrors] = useState<Record<number, string>>({})
  const [chapters, setChapters] = useState<MangaDexChapter[]>([])
  const [currentChapter, setCurrentChapter] = useState('')
  const [selectedLang, setSelectedLang] = useState(searchParams.get('lang') || settings.mangadex_language || 'pt-br')
  const [parsedType, setParsedType] = useState<'images' | 'html' | 'pdf' | 'epub' | null>(null)
  const [htmlContent, setHtmlContent] = useState('')

  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [readMode, setLocalReadMode] = useState<ReadMode>(globalReadMode)
  const [pageView, setLocalPageView] = useState<PageView>(globalPageView)
  const [uiVisible, setUiVisible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [annotMode, setAnnotMode] = useState<'none' | 'text' | 'image'>('none')
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const uiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const didPanRef = useRef(false)
  const dataSaverPagesRef = useRef<string[]>([])
  const imageRetryingRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!id) return
    void loadManga()
  }, [id])

  useEffect(() => {
    if (!id || parsedType !== 'images' || pages.length === 0) return
    const timeout = setTimeout(() => {
      window.milodex.history.save({
        manga_id: id,
        chapter_id: currentChapter,
        page_index: currentPage,
        total_pages: pages.length,
        zoom_level: zoom,
        scroll_x: pan.x,
        scroll_y: pan.y,
        read_mode: readMode
      })
    }, 250)
    return () => clearTimeout(timeout)
  }, [id, parsedType, currentChapter, currentPage, pages.length, zoom, pan.x, pan.y, readMode])

  const loadManga = async () => {
    if (!id) return
    setLoading(true)
    setError(null)

    try {
      const mangaData = await window.milodex.library.getById(id)
      if (!mangaData) {
        setError('Manga nao encontrado na biblioteca.')
        return
      }
      setManga(mangaData)

      const history = await window.milodex.history.get(id)
      if (history) {
        setCurrentPage(history.page_index || 0)
        setZoom(history.zoom_level || 1)
        setPan({ x: history.scroll_x || 0, y: history.scroll_y || 0 })
        setLocalReadMode((history.read_mode as ReadMode) || globalReadMode)
      }

      const chapterParam = searchParams.get('chapter')
      const langParam = searchParams.get('lang') || settings.mangadex_language || 'pt-br'
      setSelectedLang(langParam)

      if (mangaData.source === 'local' && mangaData.file_path) {
        await loadLocalFile(mangaData.file_path)
      } else if (mangaData.source === 'mangadex' && mangaData.mangadex_id) {
        const initialChapter = chapterParam || history?.chapter_id || ''
        const initialPage = chapterParam ? 0 : history?.page_index || 0
        await loadMangaDexChapters(mangaData.mangadex_id, initialChapter, initialPage, langParam)
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar o manga.')
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
    setCurrentChapter('local')
    setParsedType(result.type as any)
    if (result.type === 'images' && result.pages) {
      setPages(result.pages)
      setCurrentPage((page) => clamp(page, 0, Math.max(result.pages!.length - 1, 0)))
    } else if (result.type === 'html' && result.html) {
      setHtmlContent(result.html)
    }
  }

  const fetchChapters = async (mangadexId: string, lang: string): Promise<MangaDexChapter[]> => {
    const res = await window.milodex.mangadex.getChapters(mangadexId, lang, 500, 0)
    return sortMangaDexChapters((res.data || []).filter(isReadableChapter))
  }

  const loadMangaDexChapters = async (
    mangadexId: string,
    initialChapterId = '',
    initialPage = 0,
    lang = selectedLang
  ) => {
    setLoading(true)
    setError(null)
    try {
      let languageToUse = lang || 'pt-br'
      let chapterList = await fetchChapters(mangadexId, languageToUse)

      if (initialChapterId && !chapterList.some((chapter) => chapter.id === initialChapterId)) {
        const allChapters = await fetchChapters(mangadexId, 'all')
        if (allChapters.some((chapter) => chapter.id === initialChapterId)) {
          chapterList = allChapters
          languageToUse = 'all'
        }
      }

      if (chapterList.length === 0 && languageToUse !== 'all') {
        chapterList = await fetchChapters(mangadexId, 'all')
        languageToUse = 'all'
        if (chapterList.length > 0) {
          showToast({ message: 'Nenhum capitulo no idioma escolhido. Mostrando todos os idiomas.', type: 'info' })
        }
      }

      setSelectedLang(languageToUse)
      setChapters(chapterList)

      const target = chapterList.find((chapter) => chapter.id === initialChapterId) || chapterList[0]
      if (!target) {
        setError('Nenhum capitulo legivel foi encontrado no MangaDex para este manga.')
        return
      }
      await loadChapterImages(target.id, initialPage)
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar capitulos no MangaDex.')
    } finally {
      setLoading(false)
    }
  }

  const loadChapterImages = async (chapterId: string, startPage = 0) => {
    setLoading(true)
    setError(null)
    setCurrentChapter(chapterId)
    try {
      const { pages: fullQualityPages, dataSaver } = await window.milodex.mangadex.getChapterImages(chapterId)
      const nextPages = fullQualityPages.length > 0 ? fullQualityPages : dataSaver
      if (nextPages.length === 0) throw new Error('Este capitulo nao possui paginas hospedadas no MangaDex.')

      dataSaverPagesRef.current = dataSaver || []
      imageRetryingRef.current.clear()
      setChapterFallbackPages({})
      setPageErrors({})
      setPages(nextPages)
      setParsedType('images')
      setPan({ x: 0, y: 0 })

      const page = clamp(startPage, 0, nextPages.length - 1)
      setCurrentPage(page)
      await loadAnnotations(chapterId, page)
    } catch (err: any) {
      showToast({ message: err.message || 'Erro ao carregar imagens do capitulo.', type: 'error' })
      setError(err.message || 'Erro ao carregar imagens do capitulo.')
    } finally {
      setLoading(false)
    }
  }

  const loadAnnotations = async (chapterId: string, pageIdx: number) => {
    if (!id) return
    const data = await window.milodex.annotations.get(id, chapterId || 'local', pageIdx)
    setAnnotations(data)
  }

  const handleAnnotationAdd = async (annotation: Annotation) => {
    if (!id) return
    const finalAnnotation = {
      ...annotation,
      manga_id: id,
      chapter_id: currentChapter || 'local',
      page_index: currentPage
    }
    await window.milodex.annotations.save(finalAnnotation)
    setAnnotations((prev) => [...prev, finalAnnotation])
    setAnnotMode('none')
  }

  const handleAnnotationUpdate = async (annotation: Annotation) => {
    await window.milodex.annotations.save(annotation)
    setAnnotations((prev) => prev.map((item) => (item.id === annotation.id ? annotation : item)))
  }

  const handleAnnotationDelete = async (annotationId: string) => {
    await window.milodex.annotations.delete(annotationId)
    setAnnotations((prev) => prev.filter((item) => item.id !== annotationId))
  }

  const goToPage = useCallback(
    (pageIdx: number) => {
      if (pages.length === 0) return
      const clamped = clamp(pageIdx, 0, pages.length - 1)
      setCurrentPage(clamped)
      setPan({ x: 0, y: 0 })
      void loadAnnotations(currentChapter, clamped)
    },
    [pages.length, currentChapter]
  )

  const nextPage = useCallback(() => {
    goToPage(currentPage + (pageView === 'double' ? 2 : 1))
  }, [currentPage, pageView, goToPage])

  const prevPage = useCallback(() => {
    goToPage(currentPage - (pageView === 'double' ? 2 : 1))
  }, [currentPage, pageView, goToPage])

  const zoomAt = useCallback((nextZoomValue: number, clientX?: number, clientY?: number) => {
    setZoom((previousZoom) => {
      const nextZoom = clampZoom(nextZoomValue)
      if (clientX !== undefined && clientY !== undefined && viewerRef.current) {
        const rect = viewerRef.current.getBoundingClientRect()
        const originX = clientX - rect.left - rect.width / 2
        const originY = clientY - rect.top - rect.height / 2
        setPan((currentPan) => ({
          x: originX - ((originX - currentPan.x) * nextZoom) / previousZoom,
          y: originY - ((originY - currentPan.y) * nextZoom) / previousZoom
        }))
      }
      return nextZoom
    })
  }, [])

  const resetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        nextPage()
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        prevPage()
      } else if (event.key === 'Escape') {
        navigate(-1)
      } else if (event.key === '+' || event.key === '=') {
        zoomAt(zoom + 0.25)
      } else if (event.key === '-') {
        zoomAt(zoom - 0.25)
      } else if (event.key === '0') {
        resetZoom()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextPage, prevPage, navigate, zoom, zoomAt])

  const resetUiTimer = useCallback(() => {
    setUiVisible(true)
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current)
    uiTimerRef.current = setTimeout(() => setUiVisible(false), 2500)
  }, [])

  useEffect(() => {
    resetUiTimer()
    return () => {
      if (uiTimerRef.current) clearTimeout(uiTimerRef.current)
    }
  }, [currentPage, resetUiTimer])

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault()
        const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
        zoomAt(zoom * factor, event.clientX, event.clientY)
        return
      }

      if (readMode !== 'scroll') {
        event.preventDefault()
        if (event.deltaY > 0) nextPage()
        else prevPage()
      }
    },
    [nextPage, prevPage, readMode, zoom, zoomAt]
  )

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || zoom <= 1 || annotMode !== 'none' || readMode === 'scroll') return
    setIsPanning(true)
    didPanRef.current = false
    panStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isPanning) return
    const dx = event.clientX - panStartRef.current.x
    const dy = event.clientY - panStartRef.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPanRef.current = true
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy })
  }

  const handlePointerUp = () => {
    setIsPanning(false)
  }

  const handlePageClick = useCallback(
    (event: React.MouseEvent) => {
      if (annotMode !== 'none') return
      if (didPanRef.current) {
        didPanRef.current = false
        return
      }
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const clickX = event.clientX - rect.left
      if (clickX < rect.width / 2) prevPage()
      else nextPage()
    },
    [annotMode, nextPage, prevPage]
  )

  const handleImageError = useCallback(
    async (pageIndex: number, currentSrc: string) => {
      const saver = dataSaverPagesRef.current[pageIndex]
      if (saver && saver !== currentSrc) {
        setChapterFallbackPages((prev) => ({ ...prev, [pageIndex]: saver }))
        return
      }

      if (imageRetryingRef.current.has(pageIndex) || currentSrc.startsWith('data:')) {
        setPageErrors((prev) => ({ ...prev, [pageIndex]: 'Nao foi possivel carregar esta pagina.' }))
        return
      }

      imageRetryingRef.current.add(pageIndex)
      try {
        const dataUrl = await window.milodex.mangadex.getImageDataUrl(currentSrc)
        setChapterFallbackPages((prev) => ({ ...prev, [pageIndex]: dataUrl }))
      } catch {
        setPageErrors((prev) => ({ ...prev, [pageIndex]: 'Nao foi possivel carregar esta pagina.' }))
      } finally {
        imageRetryingRef.current.delete(pageIndex)
      }
    },
    []
  )

  const retryPage = (pageIndex: number) => {
    setPageErrors((prev) => {
      const next = { ...prev }
      delete next[pageIndex]
      return next
    })
    setChapterFallbackPages((prev) => {
      const next = { ...prev }
      delete next[pageIndex]
      return next
    })
  }

  const handleDownload = async () => {
    if (!currentChapter || !manga) return
    const chapter = chapters.find((item) => item.id === currentChapter)
    showToast({ message: 'Iniciando download do capitulo...', type: 'info' })
    const result = await window.milodex.mangadex.downloadChapter(
      currentChapter,
      manga.title,
      chapter?.attributes.chapter || '0'
    )
    if (result.success) showToast({ message: `Capitulo salvo como CBZ em ${result.path}`, type: 'success' })
    else showToast({ message: result.error || 'Erro no download', type: 'error' })
  }

  const handleLanguageChange = async (lang: string) => {
    setSelectedLang(lang)
    await updateSetting('mangadex_language', lang)
    if (manga?.mangadex_id) {
      await loadMangaDexChapters(manga.mangadex_id, '', 0, lang)
    }
  }

  const renderImage = (pageIndex: number, style: React.CSSProperties = {}) => {
    const src = chapterFallbackPages[pageIndex] || pages[pageIndex]
    if (!src) return null

    if (pageErrors[pageIndex]) {
      return (
        <div style={{ width: 'min(520px, 80vw)', minHeight: 320, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.65)', gap: 12, padding: 24, background: 'rgba(255,255,255,0.04)', ...style }}>
          <span>Pagina {pageIndex + 1} nao carregou.</span>
          <button className="reader-btn" onClick={(event) => { event.stopPropagation(); retryPage(pageIndex) }}>
            Tentar de novo
          </button>
        </div>
      )
    }

    return (
      <img
        src={src}
        alt={`Pagina ${pageIndex + 1}`}
        draggable={false}
        onError={() => handleImageError(pageIndex, src)}
        style={{ objectFit: 'contain', userSelect: 'none', pointerEvents: 'none', ...style }}
      />
    )
  }

  const pageTransform: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: 'center center',
    transition: isPanning ? 'none' : 'transform 0.08s ease'
  }

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
          <p>PDF: leitor interno em desenvolvimento.</p>
        </div>
      )
    }

    if (readMode === 'scroll') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', padding: '56px 0 88px' }}>
          {pages.map((_, index) => (
            <div key={index} style={{ width: `${zoom * 100}%`, maxWidth: 'none', display: 'flex', justifyContent: 'center' }}>
              {renderImage(index, { width: '100%', height: 'auto', display: 'block' })}
            </div>
          ))}
        </div>
      )
    }

    if (pageView === 'double' && pages.length > 1) {
      const leftIdx = readMode === 'rtl' ? currentPage + 1 : currentPage
      const rightIdx = readMode === 'rtl' ? currentPage : currentPage + 1
      return (
        <div
          style={{ display: 'flex', gap: 4, height: '100%', width: '100%', justifyContent: 'center', alignItems: 'center', cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'pointer', ...pageTransform }}
          onClick={handlePageClick}
        >
          {renderImage(leftIdx, { maxHeight: '100%', maxWidth: '50%' })}
          {renderImage(rightIdx, { maxHeight: '100%', maxWidth: '50%' })}
        </div>
      )
    }

    return pages[currentPage] ? (
      <div
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: annotMode !== 'none' ? 'crosshair' : zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'pointer' }}
        onClick={handlePageClick}
      >
        {renderImage(currentPage, { maxHeight: '100%', maxWidth: '100%', ...pageTransform })}
      </div>
    ) : null
  }

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
        <p style={{ fontWeight: 700, fontSize: 18 }}>Erro ao carregar</p>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, maxWidth: 420, textAlign: 'center' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Voltar</button>
      </div>
    )
  }

  const currentChapterObj = chapters.find((chapter) => chapter.id === currentChapter)
  const currentChapterIdx = chapters.findIndex((chapter) => chapter.id === currentChapter)

  return (
    <div className="reader-container" ref={containerRef} onMouseMove={resetUiTimer} onWheel={handleWheel}>
      <div className={`reader-floating-top ${uiVisible ? '' : 'reader-hidden'}`}>
        <button className="reader-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          <span style={{ fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {manga?.title || 'Voltar'}
          </span>
        </button>

        {currentChapterObj && (
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatChapterOption(currentChapterObj)}
          </span>
        )}

        {manga?.source === 'mangadex' && (
          <select
            className="input"
            style={{ width: 150, fontSize: 12, padding: '6px 8px', background: 'rgba(0,0,0,0.65)' }}
            value={selectedLang}
            onChange={(event) => handleLanguageChange(event.target.value)}
            title="Idioma dos capitulos"
          >
            {MANGADEX_LANGUAGE_FILTERS.map((lang) => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        )}

        <div className="annotation-toolbar">
          <button className={`reader-btn ${annotMode === 'text' ? 'active' : ''}`} onClick={() => setAnnotMode(annotMode === 'text' ? 'none' : 'text')} title="Adicionar texto">
            <Type size={14} />
          </button>
          <button className={`reader-btn ${annotMode === 'image' ? 'active' : ''}`} onClick={() => setAnnotMode(annotMode === 'image' ? 'none' : 'image')} title="Adicionar imagem">
            <ImageIcon size={14} />
          </button>
        </div>

        <div className="annotation-toolbar">
          <button className="reader-btn" onClick={() => zoomAt(zoom - 0.25)} title="Diminuir zoom">
            <ZoomOut size={14} />
          </button>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, minWidth: 42, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="reader-btn" onClick={() => zoomAt(zoom + 0.25)} title="Aumentar zoom">
            <ZoomIn size={14} />
          </button>
          <button className="reader-btn" onClick={resetZoom} title="Resetar zoom">
            <RotateCcw size={12} />
          </button>
        </div>

        <div className="annotation-toolbar">
          <button className={`reader-btn ${readMode === 'rtl' ? 'active' : ''}`} onClick={() => { setLocalReadMode('rtl'); setReadMode('rtl') }} title="RTL">
            RTL
          </button>
          <button className={`reader-btn ${readMode === 'ltr' ? 'active' : ''}`} onClick={() => { setLocalReadMode('ltr'); setReadMode('ltr') }} title="LTR">
            LTR
          </button>
          <button className={`reader-btn ${readMode === 'scroll' ? 'active' : ''}`} onClick={() => { setLocalReadMode('scroll'); setReadMode('scroll') }} title="Scroll vertical">
            <AlignJustify size={12} />
          </button>
          <button
            className={`reader-btn ${pageView === 'double' ? 'active' : ''}`}
            onClick={() => {
              const nextView = pageView === 'single' ? 'double' : 'single'
              setLocalPageView(nextView)
              setPageView(nextView)
            }}
            title="Pagina dupla"
          >
            <Columns size={12} />
          </button>
        </div>

        {manga?.source === 'mangadex' && (
          <button className="reader-btn" onClick={handleDownload} title="Baixar capitulo como CBZ">
            <Download size={14} />
          </button>
        )}
        <button className="reader-btn" onClick={() => window.milodex.window.fullscreen()} title="Tela cheia (F11)">
          <Maximize2 size={14} />
        </button>
      </div>

      <div
        ref={viewerRef}
        style={{ flex: 1, position: 'relative', overflow: readMode === 'scroll' ? 'auto' : 'hidden' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {renderPages()}

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

      {readMode !== 'scroll' && parsedType === 'images' && (
        <>
          <button
            className={`reader-btn ${uiVisible ? '' : 'reader-hidden'}`}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 40, padding: '12px 10px' }}
            onClick={prevPage}
            title="Pagina anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className={`reader-btn ${uiVisible ? '' : 'reader-hidden'}`}
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 40, padding: '12px 10px' }}
            onClick={nextPage}
            title="Proxima pagina"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

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
              onChange={(event) => goToPage(Number(event.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, minWidth: 60 }}>
              {pages.length > 1 ? Math.round((currentPage / (pages.length - 1)) * 100) : 0}%
            </span>
          </div>

          {chapters.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
              <button
                className="reader-btn"
                disabled={currentChapterIdx <= 0}
                onClick={() => {
                  const previous = chapters[currentChapterIdx - 1]
                  if (previous) void loadChapterImages(previous.id, 0)
                }}
              >
                <ChevronLeft size={13} /> Cap. anterior
              </button>
              <select
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', width: 'min(420px, 45vw)' }}
                value={currentChapter}
                onChange={(event) => loadChapterImages(event.target.value, 0)}
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {formatChapterOption(chapter)}
                  </option>
                ))}
              </select>
              <button
                className="reader-btn"
                disabled={currentChapterIdx >= chapters.length - 1}
                onClick={() => {
                  const next = chapters[currentChapterIdx + 1]
                  if (next) void loadChapterImages(next.id, 0)
                }}
              >
                Prox. cap. <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
