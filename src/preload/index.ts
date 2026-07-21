import { contextBridge, ipcRenderer } from 'electron'

// Expose a safe, typed API to the renderer
contextBridge.exposeInMainWorld('milodex', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    fullscreen: () => ipcRenderer.send('window:fullscreen')
  },

  // Library
  library: {
    getAll: () => ipcRenderer.invoke('library:getAll'),
    getByStatus: (status: string) => ipcRenderer.invoke('library:getByStatus', status),
    add: (entry: any) => ipcRenderer.invoke('library:add', entry),
    updateStatus: (id: string, status: string) =>
      ipcRenderer.invoke('library:updateStatus', id, status),
    remove: (id: string) => ipcRenderer.invoke('library:remove', id),
    getById: (id: string) => ipcRenderer.invoke('library:getById', id)
  },

  // History / Progress
  history: {
    get: (mangaId: string) => ipcRenderer.invoke('history:get', mangaId),
    save: (entry: any) => ipcRenderer.invoke('history:save', entry),
    getRecent: (limit?: number) => ipcRenderer.invoke('history:getRecent', limit)
  },

  // Annotations
  annotations: {
    get: (mangaId: string, chapterId: string, pageIndex: number) =>
      ipcRenderer.invoke('annotations:get', mangaId, chapterId, pageIndex),
    save: (annotation: any) => ipcRenderer.invoke('annotations:save', annotation),
    delete: (id: string) => ipcRenderer.invoke('annotations:delete', id)
  },

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },

  // Files
  files: {
    openPicker: () => ipcRenderer.invoke('files:openPicker'),
    parse: (filePath: string) => ipcRenderer.invoke('files:parse', filePath),
    readAsBase64: (filePath: string) => ipcRenderer.invoke('files:readAsBase64', filePath),
    getMetadata: (filePath: string) => ipcRenderer.invoke('files:getMetadata', filePath),
    pickImage: () => ipcRenderer.invoke('files:pickImage')
  },

  // MangaDex
  mangadex: {
    search: (query: string, filters: any) => ipcRenderer.invoke('mangadex:search', query, filters),
    getManga: (id: string) => ipcRenderer.invoke('mangadex:getManga', id),
    getChapters: (mangaId: string, lang?: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('mangadex:getChapters', mangaId, lang, limit, offset),
    getChapterImages: (chapterId: string) =>
      ipcRenderer.invoke('mangadex:getChapterImages', chapterId),
    getTrending: () => ipcRenderer.invoke('mangadex:getTrending'),
    downloadChapter: (chapterId: string, mangaTitle: string, chapterNumber: string) =>
      ipcRenderer.invoke('mangadex:downloadChapter', chapterId, mangaTitle, chapterNumber)
  }
})
