import React, { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/ToastContainer'
import Home from './pages/Home'
import Library from './pages/Library'
import Search from './pages/Search'
import LocalFiles from './pages/LocalFiles'
import Reader from './pages/Reader'
import Settings from './pages/Settings'
import { useAppStore } from './store/appStore'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }
}

export default function App() {
  const location = useLocation()
  const { fetchLibrary, fetchRecentHistory, fetchSettings } = useAppStore()
  const isReaderPage = location.pathname.startsWith('/reader/')

  useEffect(() => {
    fetchLibrary()
    fetchRecentHistory()
    fetchSettings()
  }, [])

  // Keyboard shortcut: F11 for fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault()
        window.milodex.window.fullscreen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (isReaderPage) {
    return (
      <>
        <Routes>
          <Route path="/reader/:id" element={<Reader />} />
        </Routes>
        <ToastContainer />
      </>
    )
  }

  return (
    <div className="app-layout">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}
            >
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/library" element={<Library />} />
                <Route path="/search" element={<Search />} />
                <Route path="/local" element={<LocalFiles />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
