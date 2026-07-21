import * as fs from 'fs'
import * as path from 'path'

export function parseTXT(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8')
  const title = path.basename(filePath, path.extname(filePath))

  // Convert plain text to styled HTML
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  body {
    font-family: 'Georgia', serif;
    background: #0f0f14;
    color: #e2d9c5;
    max-width: 720px;
    margin: 0 auto;
    padding: 3rem 2rem;
    line-height: 1.9;
    font-size: 1.1rem;
  }
  p { margin-bottom: 1.4em; text-indent: 2em; }
  h1 { color: #a78bfa; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
</style>
</head>
<body>
<h1>${title}</h1>
${paragraphs}
</body>
</html>`
}

export function parseHTML(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}
