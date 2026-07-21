import { ipcMain, dialog, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import axios from 'axios'
import JSZip from 'jszip'
import {
  getAllLibrary,
  getLibraryByStatus,
  addToLibrary,
  updateLibraryStatus,
  removeFromLibrary,
  getMangaById,
  getHistory,
  saveHistory,
  getRecentHistory,
  getAnnotations,
  saveAnnotation,
  deleteAnnotation,
  getSetting,
  setSetting,
  getAllSettings
} from '../db/queries'
import { parseCBZ } from '../parsers/cbz'
import { parseCBR } from '../parsers/cbr'
import { parseTXT, parseHTML } from '../parsers/text'
import { parseDOCX } from '../parsers/docx'

const MANGADEX_API = 'https://api.mangadex.org'
const MANGADEX_FEED_LIMIT = 500

function shouldFilterLanguage(lang?: string): boolean {
  return Boolean(lang && lang !== 'all')
}

function buildMangaDexPageUrls(baseUrl: string, hash: string, filenames: string[], quality: 'data' | 'data-saver'): string[] {
  return filenames.map((filename) => `${baseUrl}/${quality}/${hash}/${filename}`)
}

function assertMangaDexImageUrl(imageUrl: string): void {
  const parsed = new URL(imageUrl)
  const isMangaDexHome = parsed.protocol === 'https:' && parsed.hostname.endsWith('.mangadex.network')
  const isMangaDexUploads = parsed.protocol === 'https:' && parsed.hostname === 'uploads.mangadex.org'
  if (!isMangaDexHome && !isMangaDexUploads) {
    throw new Error('URL de imagem fora do MangaDex bloqueada por seguranca.')
  }
}

export function registerAllHandlers(): void {
  // ─── Library ────────────────────────────────────────────────────────────────
  ipcMain.handle('library:getAll', () => getAllLibrary())
  ipcMain.handle('library:getByStatus', (_e, status: string) => getLibraryByStatus(status))
  ipcMain.handle('library:add', (_e, entry) => addToLibrary(entry))
  ipcMain.handle('library:updateStatus', (_e, id: string, status: string) =>
    updateLibraryStatus(id, status)
  )
  ipcMain.handle('library:remove', (_e, id: string) => removeFromLibrary(id))
  ipcMain.handle('library:getById', (_e, id: string) => getMangaById(id))

  // ─── History ─────────────────────────────────────────────────────────────────
  ipcMain.handle('history:get', (_e, mangaId: string) => getHistory(mangaId))
  ipcMain.handle('history:save', (_e, entry) => saveHistory(entry))
  ipcMain.handle('history:getRecent', (_e, limit?: number) => getRecentHistory(limit))

  // ─── Annotations ─────────────────────────────────────────────────────────────
  ipcMain.handle(
    'annotations:get',
    (_e, mangaId: string, chapterId: string, pageIndex: number) =>
      getAnnotations(mangaId, chapterId, pageIndex)
  )
  ipcMain.handle('annotations:save', (_e, annotation) => saveAnnotation(annotation))
  ipcMain.handle('annotations:delete', (_e, id: string) => deleteAnnotation(id))

  // ─── Settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_e, key: string) => getSetting(key))
  ipcMain.handle('settings:set', (_e, key: string, value: string) => setSetting(key, value))
  ipcMain.handle('settings:getAll', () => getAllSettings())

  // ─── File System ──────────────────────────────────────────────────────────────
  ipcMain.handle('files:openPicker', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Abrir arquivo no MiloDex',
      filters: [
        {
          name: 'Todos os formatos suportados',
          extensions: ['cbz', 'cbr', 'epub', 'pdf', 'txt', 'htm', 'html', 'docx', 'doc']
        },
        { name: 'Mangá/Quadrinhos', extensions: ['cbz', 'cbr'] },
        { name: 'E-books', extensions: ['epub', 'pdf'] },
        { name: 'Documentos', extensions: ['docx', 'doc', 'txt', 'htm', 'html'] }
      ],
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('files:parse', async (_e, filePath: string) => {
    const ext = path.extname(filePath).toLowerCase()
    try {
      switch (ext) {
        case '.cbz':
          return { type: 'images', pages: await parseCBZ(filePath) }
        case '.cbr': {
          const result = await parseCBR(filePath)
          if (result.error) return { type: 'error', error: result.error }
          return { type: 'images', pages: result.pages }
        }
        case '.txt':
          return { type: 'html', html: parseTXT(filePath) }
        case '.htm':
        case '.html':
          return { type: 'html', html: parseHTML(filePath) }
        case '.docx':
        case '.doc':
          return { type: 'html', html: await parseDOCX(filePath) }
        case '.pdf':
          return { type: 'pdf', path: filePath }
        case '.epub':
          return { type: 'epub', path: filePath }
        default:
          return { type: 'error', error: `Formato ${ext} não suportado.` }
      }
    } catch (err: any) {
      return { type: 'error', error: err.message || 'Erro ao processar arquivo' }
    }
  })

  ipcMain.handle('files:readAsBase64', (_e, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath)
      return buffer.toString('base64')
    } catch {
      return null
    }
  })

  ipcMain.handle('files:getMetadata', (_e, filePath: string) => {
    try {
      const stat = fs.statSync(filePath)
      return {
        name: path.basename(filePath, path.extname(filePath)),
        ext: path.extname(filePath).toLowerCase(),
        size: stat.size,
        path: filePath
      }
    } catch {
      return null
    }
  })

  // ─── Image annotation upload ──────────────────────────────────────────────────
  ipcMain.handle('files:pickImage', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar imagem para anotação',
      filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  })

  // ─── MangaDex API ─────────────────────────────────────────────────────────────
  ipcMain.handle(
    'mangadex:search',
    async (
      _e,
      query: string,
      filters: {
        status?: string[]
        genres?: string[]
        demographic?: string[]
        language?: string
        limit?: number
        offset?: number
      }
    ) => {
      try {
        const params: Record<string, any> = {
          title: query,
          limit: filters.limit || 24,
          offset: filters.offset || 0,
          'includes[]': ['cover_art', 'author'],
          'contentRating[]': ['safe', 'suggestive', 'erotica'],
          'order[relevance]': 'desc'
        }
        if (filters.status && filters.status.length > 0) {
          params['status[]'] = filters.status
        }
        if (filters.demographic && filters.demographic.length > 0) {
          params['publicationDemographic[]'] = filters.demographic
        }
        if (shouldFilterLanguage(filters.language)) {
          params['availableTranslatedLanguage[]'] = [filters.language]
        }
        const response = await axios.get(`${MANGADEX_API}/manga`, { params, timeout: 10000 })
        return response.data
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao buscar no MangaDex')
      }
    }
  )

  ipcMain.handle('mangadex:getManga', async (_e, id: string) => {
    try {
      const response = await axios.get(`${MANGADEX_API}/manga/${id}`, {
        params: { 'includes[]': ['cover_art', 'author', 'artist'] },
        timeout: 10000
      })
      return response.data.data
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao buscar mangá')
    }
  })

  ipcMain.handle(
    'mangadex:getChapters',
    async (
      _e,
      mangaId: string,
      lang = 'pt-br',
      limit = 100,
      offset = 0
    ) => {
      try {
        const pageLimit = Math.min(Math.max(limit || 100, 1), MANGADEX_FEED_LIMIT)
        const params: Record<string, any> = {
          limit: pageLimit,
          offset,
          'order[chapter]': 'asc',
          'order[publishAt]': 'asc',
          'includes[]': ['scanlation_group', 'user'],
          includeExternalUrl: 0,
          includeEmptyPages: 0
        }
        if (shouldFilterLanguage(lang)) {
          params['translatedLanguage[]'] = [lang]
        }

        const response = await axios.get(`${MANGADEX_API}/manga/${mangaId}/feed`, {
          params,
          timeout: 10000
        })
        return response.data
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao buscar capítulos')
      }
    }
  )

  ipcMain.handle('mangadex:getChapterImages', async (_e, chapterId: string) => {
    try {
      const response = await axios.get(`${MANGADEX_API}/at-home/server/${chapterId}`, {
        timeout: 10000
      })
      const { baseUrl, chapter } = response.data
      const data = Array.isArray(chapter?.data) ? chapter.data : []
      const saver = Array.isArray(chapter?.dataSaver) ? chapter.dataSaver : []
      if (!baseUrl || !chapter?.hash || (data.length === 0 && saver.length === 0)) {
        throw new Error('Este capitulo nao possui paginas hospedadas no MangaDex.')
      }
      const pages = buildMangaDexPageUrls(baseUrl, chapter.hash, data, 'data')
      const dataSaver = buildMangaDexPageUrls(baseUrl, chapter.hash, saver, 'data-saver')
      return { pages, dataSaver }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao buscar imagens do capítulo')
    }
  })

  ipcMain.handle('mangadex:getImageDataUrl', async (_e, imageUrl: string) => {
    try {
      assertMangaDexImageUrl(imageUrl)
      const imageRes = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          Referer: 'https://mangadex.org/'
        }
      })
      const contentType = imageRes.headers['content-type'] || 'image/jpeg'
      return `data:${contentType};base64,${Buffer.from(imageRes.data).toString('base64')}`
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao recuperar imagem do MangaDex')
    }
  })

  ipcMain.handle(
    'mangadex:getTrending',
    async () => {
      try {
        const response = await axios.get(`${MANGADEX_API}/manga`, {
          params: {
            limit: 12,
            'includes[]': ['cover_art'],
            'order[followedCount]': 'desc',
            'contentRating[]': ['safe', 'suggestive'],
            'hasAvailableChapters': true
          },
          timeout: 10000
        })
        return response.data
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao buscar destaques')
      }
    }
  )

  // ─── Download Chapter as CBZ ──────────────────────────────────────────────────
  ipcMain.handle(
    'mangadex:downloadChapter',
    async (_e, chapterId: string, mangaTitle: string, chapterNumber: string) => {
      try {
        // Get image URLs
        const serverRes = await axios.get(`${MANGADEX_API}/at-home/server/${chapterId}`, {
          timeout: 10000
        })
        const { baseUrl, chapter } = serverRes.data
        const imageUrls = chapter.data.map(
          (f: string) => `${baseUrl}/data/${chapter.hash}/${f}`
        )

        // Download all images
        const zip = new JSZip()
        const folder = zip.folder(`${mangaTitle} - Chapter ${chapterNumber}`)!
        for (let i = 0; i < imageUrls.length; i++) {
          const imgRes = await axios.get(imageUrls[i], {
            responseType: 'arraybuffer',
            timeout: 30000
          })
          const ext = path.extname(imageUrls[i]).split('?')[0] || '.jpg'
          folder.file(`page_${String(i + 1).padStart(3, '0')}${ext}`, imgRes.data)
        }

        // Save CBZ
        const downloadsPath = app.getPath('downloads')
        const safeName = `${mangaTitle} - Ch.${chapterNumber}`
          .replace(/[<>:"/\\|?*]/g, '_')
        const outputPath = path.join(downloadsPath, `${safeName}.cbz`)

        const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
        fs.writeFileSync(outputPath, content)

        return { success: true, path: outputPath }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  console.log('[MiloDex] IPC handlers registered')
}
