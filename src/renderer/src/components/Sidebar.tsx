import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  BookOpen,
  Search,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

const NAV_ITEMS = [
  { path: '/', label: 'Início', icon: Home },
  { path: '/library', label: 'Biblioteca', icon: BookOpen },
  { path: '/search', label: 'Buscar Mangás', icon: Search },
  { path: '/local', label: 'Arquivos Locais', icon: FolderOpen },
  { path: '/settings', label: 'Configurações', icon: Settings }
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { showToast, fetchLibrary } = useAppStore()
  const location = useLocation()

  const handleImportFile = async () => {
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

  return (
    <motion.aside
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">M</div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="sidebar-logo-text"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              MiloDex
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Import Button */}
      <div style={{ padding: '12px 8px 4px' }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '9px' : '9px 14px', gap: 6 }}
          onClick={handleImportFile}
          title="Importar arquivo"
        >
          <Plus size={15} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                Importar
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path)
          return (
            <NavLink
              key={path}
              to={path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon className="icon" size={20} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    className="sidebar-label"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <div style={{ padding: '8px' }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-item"
          style={{ width: '100%', justifyContent: 'center', border: 'none', background: 'none' }}
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <ChevronLeft size={18} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    Recolher
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
