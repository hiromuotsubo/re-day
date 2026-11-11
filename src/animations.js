const seen = new Set()
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const { isIntersecting, target } of entries) {
    if (!isIntersecting) continue
    target.classList.replace('reveal', 'revealed')
    seen.add(target.dataset.id)
    revealObserver.unobserve(target)
  }
}, { rootMargin: '0px 0px -15% 0px' }) : null

export function revealMemories(nodes) {
  revealObserver?.disconnect()
  if (!revealObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  for (const node of nodes) {
    // 最初の画面内にすでに見えているチェキは、そのまま表示する。
    const rect = node.getBoundingClientRect()
    if (rect.top < innerHeight && rect.bottom > 0) seen.add(node.dataset.id)
    if (!seen.has(node.dataset.id)) {
      node.classList.add('reveal')
      revealObserver.observe(node)
    }
  }
}
