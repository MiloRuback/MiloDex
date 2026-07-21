import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings2, Keyboard, Palette, Moon, Monitor, Globe, Save } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const HOTKEYS = [
  { key: 'hotkey_next_page', label: 'Próxima página', default: 'ArrowRight' },
  { key: 'hotkey_prev_page', label: 'Página anterior', default: 'ArrowLeft' },
  { key: 'hotkey_fullscreen', label: 'Tela cheia', default: 'F11' },
  { key: 'hotkey_zoom_in', label: 'Aumentar zoom', default: '+' },
  { key: 'hotkey_zoom_out', label: 'Diminuir zoom', default: '-' },
  { key: 'hotkey_library', label: 'Abrir biblioteca', default: 'l' }
]

const THEMES = [
  { value: 'dark', label: 'Escuro', icon: '🌙' },
  { value: 'dark-amoled', label: 'AMOLED', icon: '⬛' },
  { value: 'purple', label: 'Purple Night', icon: '🟣' }
]

export default function Settings() {
  const { settings, updateSetting, showToast, readMode, setReadMode, pageView, setPageView } = useAppStore()
  const [hotkeys, setHotkeys] = useState<Record<string, string>>({})
  const [recordingKey, setRecordingKey] = useState<string | null>(null)

  useEffect(() => {
    const hk: Record<string, string> = {}
    HOTKEYS.forEach(({ key, default: def }) => {
      hk[key] = settings[key] || def
    })
    setHotkeys(hk)
  }, [settings])

  const handleSaveHotkey = async (key: string) => {
    await updateSetting(key, hotkeys[key])
    showToast({ message: 'Atalho salvo!', type: 'success' })
  }

  const handleRecordKey = (key: string) => {
    setRecordingKey(key)
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.key !== 'Escape') {
        setHotkeys((prev) => ({ ...prev, [key]: e.key }))
        updateSetting(key, e.key)
        showToast({ message: `Atalho "${key}" atualizado!`, type: 'success' })
      }
      setRecordingKey(null)
      window.removeEventListener('keydown', handler)
    }
    window.addEventListener('keydown', handler, { once: true })
  }

  const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ color: 'hsl(var(--primary))' }}>{icon}</span>
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16 }}>{title}</h2>
      </div>
      <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )

  const SettingRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
      <div>
        <p style={{ fontWeight: 500, fontSize: 13.5 }}>{label}</p>
        {description && <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, marginTop: 2 }}>{description}</p>}
      </div>
      <div className="no-drag">{children}</div>
    </div>
  )

  return (
    <div style={{ padding: '28px 32px 40px', maxWidth: 720 }}>
      <h1 className="page-title" style={{ marginBottom: 4 }}>Configurações</h1>
      <p className="page-subtitle" style={{ marginBottom: 32 }}>Personalize sua experiência no MiloDex</p>

      {/* Reading */}
      <Section title="Leitura" icon={<Monitor size={18} />}>
        <SettingRow label="Modo de leitura padrão" description="Como as páginas serão exibidas ao abrir um mangá">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['rtl', 'ltr', 'scroll'] as const).map((mode) => (
              <button
                key={mode}
                className={`filter-chip ${readMode === mode ? 'active' : ''}`}
                onClick={() => setReadMode(mode)}
              >
                {mode === 'rtl' ? 'RTL (Mangá)' : mode === 'ltr' ? 'LTR (Comics)' : 'Scroll'}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Visualização de página" description="Exibir uma ou duas páginas lado a lado">
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`filter-chip ${pageView === 'single' ? 'active' : ''}`}
              onClick={() => setPageView('single')}
            >Simples</button>
            <button
              className={`filter-chip ${pageView === 'double' ? 'active' : ''}`}
              onClick={() => setPageView('double')}
            >Dupla</button>
          </div>
        </SettingRow>
        <SettingRow label="Idioma preferido (MangaDex)" description="Idioma dos capítulos ao buscar online">
          <select
            className="input"
            style={{ width: 'auto', fontSize: 13 }}
            value={settings.ui_language || 'pt-BR'}
            onChange={(e) => updateSetting('ui_language', e.target.value)}
          >
            <option value="pt-br">Português (BR)</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="ja">日本語</option>
          </select>
        </SettingRow>
        <SettingRow label="Cor de fundo do leitor" description="Cor exibida atrás das páginas">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={settings.reader_bg || '#000000'}
              onChange={(e) => updateSetting('reader_bg', e.target.value)}
              style={{ width: 36, height: 28, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }}
            />
            <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
              {settings.reader_bg || '#000000'}
            </span>
          </div>
        </SettingRow>
      </Section>

      {/* Keyboard Shortcuts */}
      <Section title="Atalhos de Teclado" icon={<Keyboard size={18} />}>
        {HOTKEYS.map(({ key, label }) => (
          <SettingRow key={key} label={label}>
            <button
              onClick={() => handleRecordKey(key)}
              style={{
                background: recordingKey === key ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--secondary))',
                border: `1px solid ${recordingKey === key ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                borderRadius: 6,
                padding: '5px 14px',
                color: recordingKey === key ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                fontFamily: 'monospace',
                fontSize: 13,
                cursor: 'pointer',
                minWidth: 80,
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              {recordingKey === key ? '● Aguardando...' : (hotkeys[key] || '?')}
            </button>
          </SettingRow>
        ))}
        <div style={{ padding: '10px 18px', borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
          <p style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
            💡 Clique em um atalho e pressione a tecla desejada. Pressione Esc para cancelar.
          </p>
        </div>
      </Section>

      {/* About */}
      <Section title="Sobre o MiloDex" icon={<Settings2 size={18} />}>
        <SettingRow label="Versão" description="MiloDex Desktop">
          <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>v1.0.0</span>
        </SettingRow>
        <SettingRow label="Banco de dados" description="Localização do arquivo SQLite">
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>%APPDATA%/MiloDex/miodex.db</span>
        </SettingRow>
        <SettingRow label="API" description="Integração com MangaDex">
          <span className="badge badge-reading">Online</span>
        </SettingRow>
      </Section>
    </div>
  )
}
