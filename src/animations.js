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
    if (!seen.has(node.dataset.id)) {
      node.classList.add('reveal')
      revealObserver.observe(node)
    }
  }
}
