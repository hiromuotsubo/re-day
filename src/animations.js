const seen = new Set()
const visibleFraction = 0.25
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  let delay = 0
  for (const { intersectionRatio, target } of entries) {
    if (intersectionRatio < visibleFraction || !target.isConnected) continue
    target.style.setProperty('--reveal-delay', delay + 'ms')
    target.classList.replace('reveal', 'revealed')
    seen.add(target.dataset.id)
    revealObserver.unobserve(target)
    // 一度に数枚入ったときだけ、登場に小さな間をつくる。
    delay = Math.min(delay + 90, 180)
  }
}, { threshold: visibleFraction }) : null

export function revealMemories(nodes) {
  revealObserver?.disconnect()
  if (!revealObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  for (const node of nodes) {
    if (!seen.has(node.dataset.id)) {
      node.classList.add('reveal')
      revealObserver.observe(node)
    }
  }
}
