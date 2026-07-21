import { create } from 'zustand'
import type { LibraryEntry, HistoryEntry } from '../types/global'

interface AppState {
  // Library
  library: LibraryEntry[]
  libraryLoaded: boolean
  fetchLibrary: () => Promise<void>

  // Recent history
  recentHistory: HistoryEntry[]
  fetchRecentHistory: () => Promise<void>

  // Settings
  settings: Record<string, string>
  fetchSettings: () => Promise<void>
  updateSetting: (key: string, value: string) => Promise<void>

  // Toast
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  // Reader state
  readMode: 'rtl' | 'ltr' | 'scroll'
  pageView: 'single' | 'double'
  setReadMode: (mode: 'rtl' | 'ltr' | 'scroll') => void
  setPageView: (view: 'single' | 'double') => void
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

export const useAppStore = create<AppState>((set, get) => ({
  library: [],
  libraryLoaded: false,
  fetchLibrary: async () => {
    const items = await window.milodex.library.getAll()
    set({ library: items, libraryLoaded: true })
  },

  recentHistory: [],
  fetchRecentHistory: async () => {
    const items = await window.milodex.history.getRecent(10)
    set({ recentHistory: items })
  },

  settings: {},
  fetchSettings: async () => {
    const s = await window.milodex.settings.getAll()
    set({ settings: s, readMode: (s.read_mode as any) || 'rtl', pageView: (s.page_view as any) || 'single' })
  },
  updateSetting: async (key, value) => {
    await window.milodex.settings.set(key, value)
    set((state) => ({ settings: { ...state.settings, [key]: value } }))
  },

  toasts: [],
  showToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    const t: Toast = { ...toast, id }
    set((state) => ({ toasts: [...state.toasts, t] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }))
    }, toast.duration || 3500)
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  readMode: 'rtl',
  pageView: 'single',
  setReadMode: (mode) => {
    set({ readMode: mode })
    window.milodex.settings.set('read_mode', mode)
  },
  setPageView: (view) => {
    set({ pageView: view })
    window.milodex.settings.set('page_view', view)
  }
}))
