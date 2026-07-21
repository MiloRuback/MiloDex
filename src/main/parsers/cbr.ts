// CBR parser - CBR files are RAR archives
// Many CBR files are actually ZIP archives renamed to .cbr
// We first try JSZip (ZIP fallback), then notify if RAR extraction fails
import JSZip from 'jszip'
import * as fs from 'fs'
import * as path from 'path'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']

export async function parseCBR(filePath: string): Promise<{ pages: string[]; error?: string }> {
  // First, try ZIP fallback (many CBRs are actually ZIPs)
  try {
    const buffer = fs.readFileSync(filePath)
    const zip = await JSZip.loadAsync(buffer)

    const imageFiles: string[] = []
    zip.forEach((relativePath) => {
      const ext = path.extname(relativePath).toLowerCase()
      if (IMAGE_EXTENSIONS.includes(ext)) {
        imageFiles.push(relativePath)
      }
    })

    if (imageFiles.length === 0) {
      throw new Error('No images found in ZIP-mode CBR')
    }

    imageFiles.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    )

    const pages: string[] = []
    for (const imgPath of imageFiles) {
      const file = zip.file(imgPath)
      if (file) {
        const data = await file.async('base64')
        const ext = path.extname(imgPath).toLowerCase().replace('.', '')
        const mimeType =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'png'
              ? 'image/png'
              : ext === 'webp'
                ? 'image/webp'
                : 'image/jpeg'
        pages.push(`data:${mimeType};base64,${data}`)
      }
    }

    return { pages }
  } catch {
    return {
      pages: [],
      error:
        'Este arquivo .cbr usa compressão RAR nativa. Por favor, converta-o para .cbz usando o Calibre ou 7-Zip para leitura no MiloDex.'
    }
  }
}
