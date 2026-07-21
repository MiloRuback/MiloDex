import mammoth from 'mammoth'
import * as fs from 'fs'

export async function parseDOCX(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath)
  const result = await mammoth.convertToHtml({ buffer })

  const warnings = result.messages.length > 0
    ? `<div style="background:#2a1f00;border:1px solid #7c5c00;padding:1rem;border-radius:8px;margin-bottom:1.5rem;color:#fbbf24;">
        ⚠️ Avisos de conversão: ${result.messages.map(m => m.message).join(', ')}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Documento</title>
<style>
  body {
    font-family: 'Georgia', serif;
    background: #0f0f14;
    color: #e2d9c5;
    max-width: 780px;
    margin: 0 auto;
    padding: 3rem 2rem;
    line-height: 1.8;
    font-size: 1rem;
  }
  h1, h2, h3 { color: #a78bfa; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #333; padding: 0.5rem; }
  img { max-width: 100%; border-radius: 8px; }
  a { color: #818cf8; }
  p { margin-bottom: 1.2em; }
</style>
</head>
<body>
${warnings}
${result.value}
</body>
</html>`
}
