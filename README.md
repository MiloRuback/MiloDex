# MiloDex 📚

> **Premium desktop reader for manga, comics, and books** — powered by Electron, React, TypeScript and the MangaDex API.

![MiloDex](resources/icon.png)

## ✨ Features

- 📦 **Multi-format support**: CBZ, CBR, EPUB, PDF, TXT, HTML, DOCX, DOC
- 🌐 **MangaDex integration**: Search, browse, and read online without downloading
- 📚 **Personal library**: Track reading status (Reading, Completed, Planning, Paused)
- 📖 **Smart reader**: RTL (manga), LTR (comics), vertical scroll (webtoon) modes
- 📄 **Dual-page view**: Side-by-side page layout option
- 🔍 **Zoom & pan**: Precise zoom control with drag to pan
- ✏️ **Annotation canvas**: Add text notes and image stickers directly on pages
- 💾 **Progress persistence**: Resumes exactly where you left off, including zoom level
- ⬇️ **Chapter download**: Save MangaDex chapters as CBZ for offline reading
- ⌨️ **Custom hotkeys**: Fully configurable keyboard shortcuts
- 🌙 **Dark mode**: Immersive dark UI optimized for night reading
- 🖥️ **Fullscreen**: F11 immersive mode hides all UI

## 🛠️ Stack

| Layer | Technology |
|---|---|
| Desktop | Electron 31 (electron-vite) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS 3 + Framer Motion |
| Database | SQLite (better-sqlite3) |
| Canvas | Custom HTML5 Canvas (React) |
| API | MangaDex REST API (axios) |
| Build | electron-builder |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Development

```bash
npm install
npm run dev
```

### Build (Windows .exe)

```bash
npm run build:win
```

The installer will be in `dist/MiloDex-Setup-1.0.0.exe`.

### Build (Linux / Mac)

```bash
npm run build:linux
npm run build:mac
```

## 📁 Project Structure

```
MiloDex/
├── src/
│   ├── main/               # Electron main process
│   │   ├── db/             # SQLite database (schema + queries)
│   │   ├── ipc/            # IPC handlers (bridge to renderer)
│   │   └── parsers/        # File format parsers
│   ├── preload/            # Context bridge (secure API exposure)
│   └── renderer/           # React frontend
│       └── src/
│           ├── components/ # Reusable UI components
│           ├── pages/      # App screens
│           ├── store/      # Zustand global state
│           ├── utils/      # Helpers and utilities
│           └── types/      # TypeScript type definitions
├── resources/              # App icons
└── electron-builder.yml    # Build configuration
```

## 🗄️ Database Schema

- **`library`** — your manga/book collection with metadata and cover URLs
- **`history`** — reading progress (chapter, page, zoom, scroll position)
- **`annotations`** — text/image overlays saved per manga+chapter+page
- **`settings`** — user preferences and hotkey mappings

## 📖 Supported Formats

| Format | Type | Notes |
|---|---|---|
| `.cbz` | Manga/Comics | ZIP-based, full support |
| `.cbr` | Manga/Comics | ZIP fallback; true RAR needs conversion |
| `.epub` | E-book | Rendered via iframe |
| `.pdf` | Document | Rendered via PDF.js |
| `.txt` | Text | Converted to styled HTML |
| `.html` / `.htm` | Web | Direct render |
| `.docx` | Document | mammoth.js conversion |
| `.doc` | Document | mammoth.js (limited) |

## ⌨️ Default Hotkeys

| Action | Key |
|---|---|
| Next page | `→` |
| Previous page | `←` |
| Fullscreen | `F11` |
| Zoom in | `+` |
| Zoom out | `-` |
| Reset zoom | `0` |
| Back | `Esc` |

## 📝 License

MIT © MiloDev
