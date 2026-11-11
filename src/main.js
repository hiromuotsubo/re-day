import './style.css'
import { dailyPicks, filteredMemories, localDate, samples, shuffled } from './memories.js'
import { revealMemories } from './animations.js'
import { $, dateLabel, element, notify, photoImage, printCard, showDialog, template } from './ui.js'

let records = [...samples]
let order = shuffled(records.map(item => item.id))
let mode = 'float'
let visible = []
function openDetail(item, trigger) {
  const panel = element('div', 'detail')
  const image = element('div', 'detail-image')
  image.append(photoImage(item.image, item.alt || item.location || '登録した写真'))
  const info = element('div', 'detail-info')
  const kind = element('p', 'kind', item.source === 'sample' ? 'サンプル写真' : '自分の写真')
  const date = element('p', 'detail-date', dateLabel(item.date))
  const fields = element('dl', 'metadata')
  for (const [label, value] of [['場所', item.location], ['コメント', item.comment], ['タグ', item.tags.join('　')]]) {
    fields.append(element('dt', '', label), element('dd', '', value || '未設定'))
  }
  info.append(kind, date, fields)
  panel.append(image, info)
  const region = trigger?.closest('#daily') ? '#daily' : '#collection'
  const returnFocus = () => $(region)?.querySelector('[data-id="' + CSS.escape(item.id) + '"].print') || $('#add')
  showDialog('思い出の詳細', panel, { trigger, returnFocus, type: 'detail-dialog' })
}

function renderDaily() {
  const today = localDate()
  const dateNode = $('#today-date')
  dateNode.dateTime = today
  dateNode.textContent = dateLabel(today) + '　' + new Intl.DateTimeFormat('ja', { weekday: 'short' }).format(new Date()) + '曜日'
  const picks = dailyPicks(records, today)
  $('#daily').replaceChildren(...picks.map(item => printCard(item, openDetail)))
  if (!picks.length) $('#daily').append(element('p', 'note', '最初の写真を追加すると、ここに思い出が届きます。'))
}

function refreshTags() {
  const control = $('#tag')
  const selected = control.value
  const tags = [...new Set(records.flatMap(item => item.tags))].sort((a, b) => a.localeCompare(b, 'ja'))
  control.replaceChildren(new Option('すべて', ''), new Option('タグなし', 'none'),
    ...tags.map(tag => new Option(tag, 'tag:' + tag)))
  control.value = Array.from(control.options).some(option => option.value === selected) ? selected : ''
}

function renderCollection() {
  const source = $('#source').value
  const tag = $('#tag').value
  const sort = $('#sort').value
  visible = filteredMemories(records, { source, tag, sort }, order)
  const collection = $('#collection')
  collection.className = 'collection ' + mode
  collection.replaceChildren(...visible.map(item => {
    const wrapper = element('div', 'memory')
    wrapper.dataset.id = item.id
    const mount = element('div', 'mount')
    mount.append(printCard(item, openDetail, true))
    wrapper.append(mount)
    return wrapper
  }))
  revealMemories(mode === 'float' ? collection.children : [])
  $('#count').textContent = visible.length + ' 枚'
  $('#shuffle').disabled = sort !== 'random' || visible.length < 2
  $('#empty').hidden = visible.length > 0
  if (!visible.length) {
    const noPersonal = source === 'personal' && !records.some(item => item.source === 'personal')
    $('#empty p').textContent = noPersonal ? '自分の写真はまだありません。' : '条件に合う思い出がありません。'
    const button = $('#empty button')
    button.textContent = noPersonal ? '写真を追加' : '絞り込みを解除'
    button.onclick = noPersonal ? () => $('#add').click() : () => {
      $('#source').value = 'all'
      $('#tag').value = ''
      renderCollection()
    }
  }
}

for (const control of document.querySelectorAll('.toolbar select')) control.addEventListener('change', renderCollection)
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => {
    if (mode === button.dataset.mode) return
    mode = button.dataset.mode
    document.querySelectorAll('[data-mode]').forEach(node => node.setAttribute('aria-pressed', String(node === button)))
    renderCollection()
  })
}
$('#shuffle').addEventListener('click', () => {
  const last = visible.map(item => item.id)
  order = shuffled(order)
  const next = order.filter(id => last.includes(id))
  if (last.length > 1 && last.every((id, index) => id === next[index])) {
    const a = order.indexOf(last[0])
    const b = order.indexOf(last[1])
    ;[order[a], order[b]] = [order[b], order[a]]
  }
  renderCollection()
  notify('思い出の順番をシャッフルしました。')
})

$('#guide').addEventListener('click', () => {
  showDialog('使い方', template(`<div class="prose">
    <section><h3>毎日、2枚の思い出に出会う</h3><p>「今日の2枚」は毎日変わります。登録した写真を優先して、足りない分はサンプルから選びます。</p></section>
    <section><h3>アルバムを眺める</h3><p>スクロールするとチェキが順番に現れます。「一覧」に切り替えたり、タグや撮影日で写真を探したりできます。</p></section>
    <section><h3>自分の写真を残す</h3><p>「写真を追加」で1枚選び、日付や言葉を添えて保存します。チェキを開くと詳細を確認でき、自分の写真は後から編集・削除できます。</p></section>
    <section><h3>別の端末へ移す</h3><p>設定から写真をZIPで書き出し、移行先のブラウザで復元してください。</p></section></div>`))
})

let dailyTimer
function scheduleDaily() {
  clearTimeout(dailyTimer)
  const next = new Date()
  next.setHours(24, 0, 0, 50)
  dailyTimer = setTimeout(() => { renderDaily(); scheduleDaily() }, next - Date.now())
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && $('#today-date').dateTime !== localDate()) { renderDaily(); scheduleDaily() }
})
refreshTags()
renderDaily()
renderCollection()
scheduleDaily()
