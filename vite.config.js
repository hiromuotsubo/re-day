import { defineConfig } from 'vite'
import samples from './src/sample-data/favorites.json' with { type: 'json' }

function samplePrint({ image, date, alt }) {
  const description = alt.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  const label = date ? date.replaceAll('-', '.') : '日付未設定'
  return `<div class="print"><span class="print-image"><img loading="lazy" src="./sample/${encodeURIComponent(image)}" alt="${description}"></span><span class="print-date">${label}</span></div>`
}

export default defineConfig({
  base: './',
  plugins: [{
    name: 'static-sample-album',
    transformIndexHtml(html) {
      return html.replace('<!-- sample-prints -->', () => samples.map(samplePrint).join('\n'))
    },
  }],
})
