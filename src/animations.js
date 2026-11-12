const visibleFraction = 0.25
const tilt = {
  maxDegrees: 4,
  degreesPerSpeed: 3, // 1px/ms のスクロールに対する角度
  minSpeed: 0.035,
  smoothingMs: 80,
  returnMs: 500,
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const seen = new Set()
const visible = new Set()
let cards = []
let frame = 0
let previousY = window.scrollY
let previousFrame = 0
let lastMovement = 0
let targetAngle = 0
let angle = 0

function updateTilt(now) {
  frame = 0
  const y = window.scrollY
  const delta = y - previousY
  const elapsed = Math.max(1, now - previousFrame)
  const sinceMovement = Math.max(1, now - lastMovement)
  previousFrame = now
  previousY = y

  if (delta) {
    const speed = delta / sinceMovement
    targetAngle = Math.abs(speed) < tilt.minSpeed ? 0
      : Math.max(-tilt.maxDegrees, Math.min(tilt.maxDegrees, speed * tilt.degreesPerSpeed))
    lastMovement = now
  } else if (sinceMovement > 32) {
    // スクロールイベントの間が1フレーム空いても、すぐには揺れを止めない。
    targetAngle = 0
  }

  const smoothing = targetAngle === 0 ? tilt.returnMs / 6 : tilt.smoothingMs
  angle += (targetAngle - angle) * (1 - Math.exp(-elapsed / smoothing))
  if (!targetAngle && (Math.abs(angle) < 0.01 || now - lastMovement >= tilt.returnMs)) angle = 0
  for (const card of visible) {
    if (angle) card.style.setProperty('--scroll-tilt', angle.toFixed(3) + 'deg')
    else card.style.removeProperty('--scroll-tilt')
  }
  if (angle || targetAngle) frame = requestAnimationFrame(updateTilt)
}

function onScroll() {
  if (!visible.size) { previousY = window.scrollY; return }
  if (frame) return
  previousFrame = performance.now() - 1000 / 60
  lastMovement = previousFrame
  frame = requestAnimationFrame(updateTilt)
}

function stopTilt() {
  cancelAnimationFrame(frame)
  frame = 0
  angle = 0
  targetAngle = 0
  previousY = window.scrollY
}

const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  let delay = 0
  for (const { target, isIntersecting, intersectionRatio } of entries) {
    if (!target.isConnected) continue
    if (isIntersecting && !reducedMotion.matches) visible.add(target)
    else if (visible.delete(target)) target.style.removeProperty('--scroll-tilt')

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
  for (const card of visible) card.style.removeProperty('--scroll-tilt')
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
