const revealInset = 0.15  // 画面下端からの距離をビューポートの高さに対する割合で指定
const tilt = {
  startSpeed: 6,    // CSS px/ms
  endSpeed: 3.5,
  qualifyMs: 130,
  speedWindowMs: 32,
  maxSampleGapMs: 65,
  maxDegrees: 3,
  riseMs: 500,
  holdMs: 250,
  returnMs: 800,
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const seen = new Set()
const visible = new Set()
let cards = []

let sampleY = 0
let sampleStart = 0
let lastScroll = null
let candidateDirection = 0
let candidateSince = 0
let gust = null
let frame = 0
let cssAngle = ''

function paintTilt(degrees) {
  const value = degrees ? degrees.toFixed(3) + 'deg' : ''
  if (value === cssAngle) return
  cssAngle = value
  for (const card of visible) card.style.setProperty('--scroll-tilt', value)
}

function ease(progress) {
  const t = Math.max(0, Math.min(1, progress))
  return t * t * (3 - 2 * t)
}

function animateTilt(now) {
  const release = (now - gust.lastFast - tilt.holdMs) / tilt.returnMs
  if (release >= 1) { stopTilt(); return }

  // 入力が途切れたら、それまでに達した角度で余韻を保つ。
  const movingUntil = Math.min(now, gust.lastFast + tilt.maxSampleGapMs)
  gust.riseTime += Math.max(0, movingUntil - gust.lastFrame)
  gust.lastFrame = now
  const peak = gust.direction * tilt.maxDegrees * ease(gust.riseTime / tilt.riseMs)
  paintTilt(peak * (1 - ease(release)))
  frame = requestAnimationFrame(animateTilt)
}

function onScroll() {
  const now = performance.now()
  const y = window.scrollY
  if (!visible.size || lastScroll === null || now - lastScroll > tilt.maxSampleGapMs) {
    candidateDirection = 0
    sampleStart = now
    sampleY = y
  }
  lastScroll = now
  // 短い区間の平均速度を使い、イベントごとの移動量のばらつきをならす。
  const elapsed = now - sampleStart
  if (elapsed < tilt.speedWindowMs) return
  const speed = (y - sampleY) / elapsed
  sampleStart = now
  sampleY = y
  if (gust) {
    // 復帰が始まったら、逆方向の入力でも正面まで戻し切る。
    if (now - gust.lastFast < tilt.holdMs &&
        speed * gust.direction >= tilt.endSpeed) {
      gust.lastFast = now
    }
    return
  }

  if (Math.abs(speed) < tilt.startSpeed) { candidateDirection = 0; return }
  const direction = Math.sign(speed)
  if (direction !== candidateDirection) {
    candidateDirection = direction
    candidateSince = now - elapsed
  }
  if (now - candidateSince < tilt.qualifyMs) return

  gust = { direction, lastFast: now, lastFrame: now, riseTime: 0 }
  frame = requestAnimationFrame(animateTilt)
}

function stopTilt() {
  cancelAnimationFrame(frame)
  frame = 0
  gust = null
  lastScroll = null
  candidateDirection = 0
  paintTilt(0)
}

let revealObserver
let insetPixels
let initialViewport

function revealCard(card) {
  seen.add(card.dataset.id)
  card.classList.replace('reveal', 'revealed')
  revealObserver?.unobserve(card)
}

function observeRevealLine() {
  // rootMargin の % は横幅を基準にするため、高さから px を求める。
  const inset = Math.round(document.documentElement.clientHeight * revealInset)
  if (revealObserver && inset === insetPixels) return
  insetPixels = inset
  revealObserver?.disconnect()
  revealObserver = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && target.isConnected) revealCard(target)
    }
  }, { rootMargin: `0px 0px -${inset}px 0px` })
  for (const card of cards) {
    if (seen.has(card.dataset.id)) continue
    revealObserver.observe(card)
    card.classList.add('reveal')
  }
}

const viewportObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    if (!target.isConnected) continue
    if (isIntersecting && (initialViewport || reducedMotion.matches)) revealCard(target)
    if (isIntersecting && !reducedMotion.matches) {
      visible.add(target)
      if (cssAngle) target.style.setProperty('--scroll-tilt', cssAngle)
    } else if (visible.delete(target)) {
      target.style.removeProperty('--scroll-tilt')
    }
  }
  initialViewport = false
  if (!visible.size) stopTilt()
}) : null

export function observeMemories(nodes) {
  viewportObserver?.disconnect()
  revealObserver?.disconnect()
  revealObserver = null
  window.removeEventListener('resize', observeRevealLine)
  window.removeEventListener('scroll', onScroll)
  stopTilt()
  visible.clear()
  cards = nodes
  if (!viewportObserver || !cards.length) return
  initialViewport = true
  for (const card of cards) {
    card.classList.remove('reveal', 'revealed')
    viewportObserver.observe(card)
  }
  if (reducedMotion.matches) return
  observeRevealLine()
  window.addEventListener('resize', observeRevealLine)
  window.addEventListener('scroll', onScroll, { passive: true })
}

document.querySelector('#collection').addEventListener('focusin', event => {
  const card = event.target.closest('.reveal')
  if (card) {
    card.classList.remove('reveal')
    revealCard(card)
  }
})

reducedMotion.addEventListener('change', () => observeMemories(cards))
