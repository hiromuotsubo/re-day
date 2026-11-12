export const $ = selector => document.querySelector(selector)

export function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function photoImage(url, alt, lazy = false) {
  const image = new Image()
  image.alt = alt
  image.decoding = 'async'
  if (lazy) image.loading = 'lazy'
  image.addEventListener('error', () => image.replaceWith(element('span', 'image-error', '画像を読み込めませんでした')), { once: true })
  image.src = url
  return image
}

export function dateLabel(date) {
  return date ? date.replaceAll('-', '.') : '日付未設定'
}

export function printCard(item, onOpen, lazy = false) {
  const card = element(onOpen ? 'button' : 'div', 'print')
  const description = item.alt || item.location || '登録した写真'
  if (onOpen) {
    card.dataset.id = item.id
    card.setAttribute('aria-haspopup', 'dialog')
    card.setAttribute('aria-label', description + '、' + dateLabel(item.date) + 'のチェキをめくる')
    card.addEventListener('click', () => onOpen(item, card))
  }
  const frame = element('span', 'print-image')
  frame.append(photoImage(item.image, description, lazy))
  if (onOpen) {
    frame.append(template('<span class="flip-hint" aria-hidden="true"><svg class="icon"><use href="./icons.svg#turn"/></svg></span>'))
  }
  const date = element(item.date ? 'time' : 'span', 'print-date', dateLabel(item.date))
  if (item.date) date.dateTime = item.date
  else date.classList.add('unknown')
  card.append(frame, date)
  return card
}

const modal = $('#dialog')
const titleNode = $('#dialog-title')
let opener
let resolveOpener
let onLeave
let busy = false
const dialogBody = $('#dialog-body')

export function showDialog(title, content, { trigger, returnFocus, leave, type = '' } = {}) {
  if (!modal.open) {
    opener = trigger || document.activeElement
    resolveOpener = returnFocus
  }
  onLeave?.()
  onLeave = leave
  modal.className = type
  titleNode.textContent = title
  dialogBody.replaceChildren(content)
  if (!modal.open) modal.showModal()
  modal.scrollTop = 0
  titleNode.focus({ preventScroll: true })
}

export function setBusy(value) {
  busy = value
  modal.querySelector('.close').disabled = value
  if (value) modal.setAttribute('aria-busy', 'true')
  else modal.removeAttribute('aria-busy')
}

export function closeDialog() {
  if (!busy) modal.close()
}

modal.querySelector('.close').addEventListener('click', closeDialog)
modal.addEventListener('cancel', event => { if (busy) event.preventDefault() })
modal.addEventListener('close', () => {
  onLeave?.()
  onLeave = null
  dialogBody.replaceChildren()
  const target = opener?.isConnected ? opener : resolveOpener?.()
  target?.focus({ preventScroll: true })
})
let noticeTimer
export function notify(message) {
  $('#notice').textContent = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { $('#notice').textContent = '' }, 4200)
}

// Templates passed here are static. User content is inserted with textContent or value.
export function template(markup) {
  const node = document.createElement('template')
  node.innerHTML = markup.trim()
  return node.content.firstElementChild
}
