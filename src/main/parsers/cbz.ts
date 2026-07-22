import JSZip from 'jszip'
import * as fs from 'fs'
import * as path from 'path'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']

export async function parseCBZ(filePath: string): Promise<string[]> {
  const buffer = fs.readFileSync(filePath)
  const zip = await JSZip.loadAsync(buffer)

  const imageFiles: string[] = []

  zip.forEach((relativePath) => {
    const ext = path.extname(relativePath).toLowerCase()
    if (IMAGE_EXTENSIONS.includes(ext)) {
      imageFiles.push(relativePath)
    }
  })

  // Natural sort for correct page order
  imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  // Extract each image as base64 data URL
  const pages: string[] = []
  for (const imgPath of imageFiles) {
    const file = zip.file(imgPath)
    if (file) {
      const data = await file.async('base64')
      const ext = path.extname(imgPath).toLowerCase().replace('.', '')
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : ext === 'gif' ? 'image/gif'
        : 'image/jpeg'
      pages.push(`data:${mimeType};base64,${data}`)
    }
  }

  return pages
}
