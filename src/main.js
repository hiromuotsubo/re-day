import { dailyPicks, filteredMemories, localDate, samples, seasonForDate, shuffled } from './memories.js'
import { observeMemories } from './animations.js'
import { $, dateLabel, element, notify, printCard, showDialog, template } from './ui.js'

import { allPersonal } from './storage.js'
import { confirmDeletion, openEditor } from './editor.js'
import { openSettings } from './settings.js'

let records = [...samples]
const changes = typeof BroadcastChannel === 'function' ? new BroadcastChannel('re-day:changes') : null
let refreshVersion = 0

async function refresh() {
  const version = ++refreshVersion
  const stored = await allPersonal()
  if (version !== refreshVersion) return
  const old = records.filter(item => item.source === 'personal')
  const existing = new Map(old.map(item => [item.id, item]))
  const personal = stored.map(item => {
    const previous = existing.get(item.id)
    if (previous?.updatedAt === item.updatedAt) return previous
    return { ...item, blob: item.image, image: URL.createObjectURL(item.image) }
  })
  records = [...samples, ...personal]
  const ids = new Set(records.map(item => item.id))
  order = order.filter(id => ids.has(id))
  const known = new Set(order)
  order.push(...shuffled(records.filter(item => !known.has(item.id)).map(item => item.id)))
  refreshTags()
  renderDaily()
  renderCollection()
  const stillInUse = new Set(personal)
  old.filter(item => !stillInUse.has(item)).forEach(item => URL.revokeObjectURL(item.image))
}

async function updateAlbum() {
  changes?.postMessage('changed')
  await refresh()
}

changes?.addEventListener('message', () => refresh().catch(() => notify('アルバムを更新できません。ページを再読み込みしてください。')))

function savedDetail(id) {
  return updateAlbum().then(() => {
    const item = records.find(record => record.id === id)
    if (item) openDetail(item)
  })
}

$('#add').onclick = event => openEditor({ trigger: event.currentTarget, onSaved: savedDetail })
let order = []
let mode = 'float'
let visible = []
function openDetail(item, trigger) {
  const panel = template(`<div>
    <div class="card-stage"><div class="turning-card">
      <div class="paper-back" role="region" aria-label="チェキの裏面" tabindex="0">
        <p class="kind"></p><p class="detail-date"></p><dl class="metadata"></dl>
      </div>
    </div></div>
    <button class="turn-card" type="button"><svg class="icon" aria-hidden="true"><use href="./icons.svg#turn"/></svg><span></span></button>
  </div>`)
  const stage = panel.querySelector('.card-stage')
  const card = panel.querySelector('.turning-card')
  const back = panel.querySelector('.paper-back')
  const turn = panel.querySelector('.turn-card')
  const front = printCard(item)
  card.prepend(front)
  back.querySelector('.kind').textContent = item.source === 'sample' ? 'サンプル写真' : '自分の写真'
  back.querySelector('.detail-date').textContent = dateLabel(item.date)
  const fields = back.querySelector('.metadata')
  for (const [label, value] of [['場所', item.location], ['コメント', item.comment], ['タグ', item.tags.join('　')]]) {
    fields.append(element('dt', '', label), element('dd', '', value || '未設定'))
  }
  if (item.source === 'personal') {
    const actions = element('div', 'actions')
    const edit = element('button', 'secondary', '編集')
    const remove = element('button', 'delete-link', '削除')
    const reopen = () => openDetail(records.find(record => record.id === item.id) || item)
    edit.onclick = () => openEditor({ item, onSaved: savedDetail, onCancel: reopen })
    remove.onclick = () => confirmDeletion(item, updateAlbum, reopen)
    actions.append(edit, remove)
    back.append(actions)
  }

  function showBack(isBack) {
    card.classList.toggle('is-back', isBack)
    front.inert = isBack
    back.inert = !isBack
    turn.querySelector('span').textContent = isBack ? '写真を見る' : '裏面を見る'
  }
  turn.onclick = () => showBack(!front.inert)
  const origin = trigger?.getBoundingClientRect()
  const region = trigger?.closest('#daily') ? '#daily' : '#collection'
  const returnFocus = () => $(region)?.querySelector('[data-id="' + CSS.escape(item.id) + '"].print') || $('#add')
  const animate = origin && !matchMedia('(prefers-reduced-motion: reduce)').matches
  showBack(!animate)
  showDialog('思い出の詳細', panel, {
    trigger, returnFocus, type: 'flip-dialog',
    leave: () => trigger?.classList.remove('lifted'),
  })
  trigger?.classList.add('lifted')
  if (animate) {
    // 元のチェキの位置・大きさから、手に取った位置まで同じ紙を運ぶ。
    const dest = stage.getBoundingClientRect()
    const x = origin.left - dest.left
    const y = origin.top - dest.top
    stage.animate([
      { transform: `translate(${x}px, ${y}px) scale(${origin.width / dest.width}, ${origin.height / dest.height})` },
      { transform: 'none' },
    ], { duration: 600, easing: 'cubic-bezier(.22,.68,.25,1)' })
    showBack(true)
  }
}

function memoryFrame(item, content) {
  const frame = element('div', 'memory')
  const season = seasonForDate(item.date)
  if (season) frame.dataset.season = season
  frame.append(content)
  return frame
}

function renderDaily() {
  const today = localDate()
  const dateNode = $('#today-date')
  dateNode.dateTime = today
  dateNode.textContent = dateLabel(today) + '　' + new Intl.DateTimeFormat('ja', { weekday: 'short' }).format(new Date()) + '曜日'
  const picks = dailyPicks(records, today)
  $('#daily').replaceChildren(...picks.map(item => memoryFrame(item, printCard(item, openDetail))))
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
    const mount = element('div', 'mount')
    mount.append(printCard(item, openDetail, true))
    const wrapper = memoryFrame(item, mount)
    wrapper.dataset.id = item.id
    return wrapper
  }))
  observeMemories(mode === 'float' ? collection.children : [])
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

for (const button of [$('#settings'), $('#footer-settings')]) {
  button.onclick = () => openSettings(button, updateAlbum)
}

$('#guide').addEventListener('click', () => {
  showDialog('使い方', template(`<div class="prose">
    <section><h3>毎日、2枚の思い出に出会う</h3><p>「今日の2枚」は毎日変わります。登録した写真を優先して、足りない分はサンプルから選びます。</p></section>
    <section><h3>アルバムを眺める</h3><p>スクロールするとチェキが順番に現れます。「一覧」に切り替えたり、タグや撮影日で写真を探したりできます。</p></section>
    <section><h3>自分の写真を残す</h3><p>「写真を追加」で1枚選び、日付や言葉を添えて保存します。チェキを押すと裏返り、場所・コメント・タグが読めます。「写真を見る」で表に戻せます。自分の写真は裏面から編集・削除できます。</p></section>
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
async function start() {
  try { await refresh() }
  catch {
    refreshTags()
    renderDaily()
    renderCollection()
    notify('ブラウザの保存領域を開けませんでした。サンプル写真を表示します。')
  }
  scheduleDaily()
}
start()
