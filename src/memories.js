import catalog from './sample-data/favorites.json'

export const samples = catalog.map(entry => ({
  location: '', comment: '', tags: [], createdAt: '', updatedAt: '',
  ...entry,
  source: 'sample',
  image: import.meta.env.BASE_URL + 'sample/' + entry.image,
}))

export function localDate(now = new Date()) {
  const pad = number => String(number).padStart(2, '0')
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('-')
}

export function validDate(value) {
  if (value === '') return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const day = new Date(value + 'T00:00:00Z')
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value
}

export function seasonForDate(date) {
  if (!date || !validDate(date)) return ''
  const month = Number(date.slice(5, 7))
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function shuffled(items) {
  const result = [...items]
  for (let end = result.length - 1; end > 0; end--) {
    const index = Math.floor(Math.random() * (end + 1))
    ;[result[index], result[end]] = [result[end], result[index]]
  }
  return result
}

const dailyKey = 're-day:daily:v1'
let currentDraw

export function dailyPicks(records, today = localDate()) {
  let saved = currentDraw
  try { saved = JSON.parse(localStorage.getItem(dailyKey)) || currentDraw } catch { /* Storage can be disabled. */ }
  const previous = Array.isArray(saved?.ids) ? [...new Set(saved.ids)] : []
  const picked = []
  for (const source of ['personal', 'sample']) {
    const pool = records.filter(item => item.source === source)
    const retained = previous.map(id => pool.find(item => item.id === id)).filter(Boolean)
    const rest = shuffled(pool.filter(item => !previous.includes(item.id)))
    const candidates = saved?.day === today ? [...retained, ...rest] : [...rest, ...retained]
    picked.push(...candidates.slice(0, 2 - picked.length))
  }
  const next = { day: today, ids: picked.map(item => item.id) }
  if (JSON.stringify(saved) !== JSON.stringify(next)) {
    try { localStorage.setItem(dailyKey, JSON.stringify(next)) } catch { /* Use the in-memory draw. */ }
  }
  currentDraw = next
  return picked
}

export function filteredMemories(records, { source, tag, sort }, order) {
  const matches = records.filter(item => (source === 'all' || item.source === source)
    && (tag === '' || (tag === 'none' ? !item.tags.length : item.tags.includes(tag.slice(4)))))
  if (sort === 'random') {
    const rank = new Map(order.map((id, index) => [id, index]))
    return matches.sort((a, b) => rank.get(a.id) - rank.get(b.id))
  }
  return matches.sort((a, b) => {
    if (!a.date || !b.date) return Number(!a.date) - Number(!b.date)
    return sort === 'new' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
  })
}
