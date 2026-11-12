import { localDate } from './memories.js'
import { storedChanges, restoreMissing, storageMessage } from './storage.js'
import { setBusy, showDialog, template } from './ui.js'

export function openSettings(trigger, onRestore) {
  const panel = template(`<div class="settings-panel">
    <section><h3>写真の保存先</h3>
      <p>ログインは不要です。登録した写真は、この端末のブラウザ内に保存されます。別の端末やブラウザには自動で同期されません。</p>
      <p>ブラウザのデータを消去すると写真も失われます。共有端末では、同じブラウザプロファイルを使う人が写真を閲覧できます。</p>
      <div class="storage-controls"><p class="storage-info"></p><button class="secondary persist" hidden>永続ストレージをリクエスト</button></div>
    </section>
    <section><h3>バックアップ</h3><p>自分の写真と、サンプルの編集・削除内容をZIPファイルにまとめます。個人の写真が含まれるため、保管場所にご注意ください。</p>
      <button class="secondary export"><svg class="icon"><use href="./icons.svg#download"/></svg>ZIPに書き出す</button></section>
    <section><h3>復元</h3><p>re:dayで書き出したZIPを選びます。同じIDの写真はスキップし、新しい写真だけを追加します。</p>
      <input type="file" class="backup-file" accept=".zip,application/zip" hidden>
      <button class="secondary import"><svg class="icon"><use href="./icons.svg#upload"/></svg>ZIPから復元</button></section>
    <p class="result" role="status"></p><p class="error" role="alert"></p>
  </div>`)
  const status = panel.querySelector('.result')
  const error = panel.querySelector('.error')
  const input = panel.querySelector('.backup-file')
  const persist = panel.querySelector('.persist')
  const info = panel.querySelector('.storage-info')
  const storage = navigator.storage
  const controls = panel.querySelectorAll('button')

  async function storageInfo() {
    const [estimate, persistent] = await Promise.all([
      storage?.estimate?.().catch(() => null), storage?.persisted?.().catch(() => false),
    ])
    const pieces = []
    if (estimate?.usage !== undefined) {
      pieces.push('このサイトの使用量 約' + (estimate.usage / 1024 ** 2).toFixed(1) + ' MB')
    }
    if (persistent) pieces.push('永続ストレージ有効')
    info.textContent = pieces.join(' ／ ')
    persist.hidden = persistent || !storage?.persist
  }

  async function run(message, task) {
    setBusy(true)
    controls.forEach(button => { button.disabled = true })
    error.textContent = ''
    status.textContent = message
    try {
      status.textContent = await task()
      await storageInfo()
    } catch (cause) {
      status.textContent = ''
      error.textContent = storageMessage(cause)
    } finally { setBusy(false); controls.forEach(button => { button.disabled = false }) }
  }

  persist.onclick = () => run('保存設定を確認しています…', async () => {
    const allowed = await storage.persist()
    return allowed ? '永続ストレージが有効になりました。' : 'ブラウザは永続ストレージを許可しませんでした。ZIPのバックアップをご利用ください。'
  })
  panel.querySelector('.export').onclick = () => run('バックアップを作成しています…', async () => {
    const memories = await storedChanges()
    if (!memories.length) return '書き出す写真がありません。写真を追加するか、サンプルを変更してください。'
    const { createBackup } = await import('./backup.js')
    const url = URL.createObjectURL(await createBackup(memories))
    const link = document.createElement('a')
    link.href = url
    link.download = 're-day-' + localDate() + '.zip'
    panel.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return memories.length + '枚のバックアップを書き出しました。'
  })
  panel.querySelector('.import').onclick = () => input.click()
  input.onchange = () => {
    const file = input.files[0]
    input.value = ''
    if (!file) return
    run('バックアップを確認しています…', async () => {
      const { readBackup } = await import('./backup.js')
      const records = await readBackup(file)
      const added = await restoreMissing(records)
      if (added) await onRestore()
      return added + '枚を復元しました。重複 ' + (records.length - added) + '枚をスキップしました。'
    })
  }
  showDialog('設定・データ管理', panel, { trigger })
  storageInfo()
}
