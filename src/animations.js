const visibleFraction = 0.25
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

const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  let delay = 0
  for (const { target, isIntersecting, intersectionRatio } of entries) {
    if (!target.isConnected) continue
    if (isIntersecting && !reducedMotion.matches) {
      visible.add(target)
      if (cssAngle) target.style.setProperty('--scroll-tilt', cssAngle)
    } else if (visible.delete(target)) {
      target.style.removeProperty('--scroll-tilt')
    }

    if (intersectionRatio < visibleFraction || seen.has(target.dataset.id)) continue
    seen.add(target.dataset.id)
    if (target.classList.replace('reveal', 'revealed')) {
      target.style.setProperty('--reveal-delay', delay + 'ms')
      delay = Math.min(delay + 90, 180)
    }
  }
  if (!visible.size) stopTilt()
}, { threshold: [0, visibleFraction] }) : null

export function observeMemories(nodes) {
  cards = nodes
  observer?.disconnect()
  window.removeEventListener('scroll', onScroll)
  stopTilt()
  visible.clear()
  if (!observer) return
  for (const node of cards) {
    node.classList.remove('revealed')
    node.classList.toggle('reveal', !reducedMotion.matches && !seen.has(node.dataset.id))
    observer.observe(node)
  }
  if (cards.length && !reducedMotion.matches) window.addEventListener('scroll', onScroll, { passive: true })
}

reducedMotion.addEventListener('change', () => observeMemories(cards))
