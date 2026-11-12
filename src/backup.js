import { BlobReader, BlobWriter, TextReader, TextWriter, ZipReader, ZipWriter } from '@zip.js/zip.js/lib/zip-core-external.js'
import { samples, validDate } from './memories.js'
import { readablePhoto } from './photos.js'

const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }
const format = 're-day-album'
const options = { useWebWorkers: false, level: 0 }
const idPattern = /^personal-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

const sampleIds = new Set(samples.map(item => item.id))

export async function createBackup(records) {
  const writer = new ZipWriter(new BlobWriter('application/zip'), options)
  const memories = []
  const deletedSamples = []
  for (const record of records) {
    if (record.deleted) { deletedSamples.push(record.id); continue }
    const { id, image, date, location, comment, tags, createdAt, updatedAt } = record
    const file = 'photos/' + id + '.' + extensions[image.type]
    await writer.add(file, new BlobReader(image))
    memories.push({ id, file, alt: record.alt || '', date, location, comment, tags, createdAt, updatedAt })
  }
  await writer.add('album.json', new TextReader(JSON.stringify({ format, version: 2, memories, deletedSamples }, null, 2)))
  return writer.close()
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function validRecord(record) {
  return record && typeof record.id === 'string' && (idPattern.test(record.id) || sampleIds.has(record.id))
    && typeof record.file === 'string' && validDate(record.date)
    && typeof record.location === 'string' && typeof record.comment === 'string'
    && Array.isArray(record.tags) && record.tags.every(tag => typeof tag === 'string')
    && validTimestamp(record.createdAt) && validTimestamp(record.updatedAt)
}

export async function readBackup(file) {
  const reader = new ZipReader(new BlobReader(file), {
    useWebWorkers: false, checkCrc32: true, checkOverlappingEntry: true, strictness: 'strict',
  })
  try {
    const entries = await reader.getEntries()
    const files = new Map(entries.map(entry => [entry.filename, entry]))
    const manifest = files.get('album.json')
    const totalSize = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
    if (!manifest || totalSize > file.size || files.size !== entries.length || entries.some(entry =>
      entry.encrypted || entry.directory || entry.compressionMethod !== 0 || entry.uncompressedSize !== entry.compressedSize)) {
      throw new Error()
    }
    const catalog = JSON.parse(await manifest.getData(new TextWriter()))
    if (catalog?.format !== format || ![1, 2].includes(catalog.version) || !Array.isArray(catalog.memories)
      || catalog.memories.length !== files.size - 1) throw new Error()
    const deleted = catalog.version === 2 ? catalog.deletedSamples : []
    if (!Array.isArray(deleted) || deleted.some(id => !sampleIds.has(id))) throw new Error()
    const ids = new Set(deleted)
    if (ids.size !== deleted.length) throw new Error()
    const records = deleted.map(id => ({ id, deleted: true, updatedAt: new Date().toISOString() }))
    for (const record of catalog.memories) {
      if (!validRecord(record) || ids.has(record.id)) throw new Error()
      ids.add(record.id)
      const entry = files.get(record.file)
      if (!entry || !record.file.startsWith('photos/' + record.id + '.')) throw new Error()
      const image = await readablePhoto(await entry.getData(new BlobWriter()))
      if (record.file !== 'photos/' + record.id + '.' + extensions[image.type]) throw new Error()
      const { id, date, location, comment, tags, createdAt, updatedAt } = record
      records.push({ id, source: sampleIds.has(id) ? 'sample' : 'personal', alt: typeof record.alt === 'string' ? record.alt : '', image, date, location, comment, tags, createdAt, updatedAt })
    }
    return records
  } catch {
    throw new Error('写真または登録情報を読み取れませんでした。re:dayで書き出したZIPファイルを選んでください。')
  } finally { await reader.close() }
}
