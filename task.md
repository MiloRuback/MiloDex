# MiloDex - Task Progress

## Fase 1: Setup do Projeto
- [/] Inicializar Git repo
- [ ] Criar package.json e estrutura base (electron-vite)
- [ ] Instalar dependências
- [ ] Configurar Tailwind CSS + Shadcn
- [ ] Configurar electron-builder

## Fase 2: Banco de Dados
- [ ] Schema SQLite (library, history, annotations, settings)
- [ ] Queries helpers

## Fase 3: IPC Bridge
- [ ] IPC handlers (main process)
- [ ] Preload script (contextBridge)

## Fase 4: Design System
- [ ] CSS variables e tokens (dark theme)
- [ ] Logo MiloDex (SVG)
- [ ] Sidebar retrátil
- [ ] Componentes base (MangaCard, ProgressBar, Badge, SearchBar)

## Fase 5: Telas
- [ ] App.tsx + Router
- [ ] Home.tsx
- [ ] Library.tsx
- [ ] Search.tsx
- [ ] Reader.tsx (com Canvas Konva)
- [ ] Settings.tsx

## Fase 6: Parsers de Arquivos
- [ ] CBZ parser (JSZip)
- [ ] CBR parser (fallback ZIP)
- [ ] EPUB parser
- [ ] PDF parser
- [ ] TXT/HTML parser
- [ ] DOCX parser (mammoth)

## Fase 7: MangaDex API
- [ ] Search manga
- [ ] Get chapter images
- [ ] Download chapter (→ CBZ)

## Fase 8: Build
- [ ] electron-builder.yml
- [ ] Ícone MiloDex (.ico)
- [ ] Testar build .exe

## Git Commits
- [ ] feat: initial project setup
- [ ] feat: database schema
- [ ] feat: ipc bridge
- [ ] feat: ui design system
- [ ] feat: pages and router
- [ ] feat: file parsers
- [ ] feat: mangadex integration
- [ ] feat: reader canvas annotations
- [ ] chore: build configuration
