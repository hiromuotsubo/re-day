export async function readablePhoto(file) {
  if (!(file instanceof Blob) || !file.size) throw new Error('画像ファイルを選んでください。')
  const bytes = new Uint8Array(await file.slice(0, 48).arrayBuffer())
  const header = String.fromCharCode(...bytes)
  let type
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) type = 'image/jpeg'
  else if (header.startsWith('\u0089PNG\r\n\u001a\n')) type = 'image/png'
  else if (/^GIF8[79]a/.test(header)) type = 'image/gif'
  else if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') type = 'image/webp'
  else if (header.slice(4, 8) === 'ftyp' && /avif|avis/.test(header.slice(8))) type = 'image/avif'
  if (!type) throw new Error('JPEG、PNG、WebP、GIF、AVIFの画像を選んでください。')
  const blob = file.slice(0, file.size, type)
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth) throw new Error()
  } catch { throw new Error('この画像を開けません。別の画像を選んでください。') }
  finally { URL.revokeObjectURL(url) }
  return blob
}
