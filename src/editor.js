import { closeDialog, dateLabel, notify, printCard, setBusy, showDialog, template } from './ui.js'
import { deleteMemory, saveMemory, storageMessage } from './storage.js'
import { readablePhoto } from './photos.js'

export function openEditor({ item, trigger, onSaved, onCancel }) {
  if (item && item.source !== 'personal') return
  const form = template(`<form class="editor">
    <div class="upload-area">
      <input id="image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" class="visually-hidden">
      <label class="drop-zone" for="image-file"><svg class="icon"><use href="./icons.svg#photo"/></svg><strong>写真を選ぶ</strong><span>または、ここにドラッグ＆ドロップ</span></label>
      <div id="preview"></div>
      <button type="button" class="replace secondary" hidden>写真を差し替える</button>
    </div>
    <div class="form-fields">
      <label>撮影日<input name="date" type="date" max="9999-12-31"></label>
      <label>場所<input name="location" type="text" placeholder="撮影した場所"></label>
      <label class="wide">コメント<textarea name="comment" rows="3" placeholder="その日のこと"></textarea></label>
      <label class="wide">タグ<input name="tags" type="text" placeholder="例：旅、海"><small>複数のタグは読点またはカンマで区切ります。</small></label>
    </div>
    <p class="note">写真は元の画質で、このブラウザに保存されます。</p>
    <p class="error" role="alert"></p>
    <div class="actions"><button type="button" class="secondary cancel">キャンセル</button><button class="primary save" type="submit">保存</button></div>
  </form>`)
  const fields = form.elements
  for (const name of ['date', 'location', 'comment']) fields[name].value = item?.[name] || ''
  fields.tags.value = item?.tags.join('、') || ''
  const preview = form.querySelector('#preview')
  const drop = form.querySelector('.drop-zone')
  const replace = form.querySelector('.replace')
  const errorText = form.querySelector('.error')
  const fileInput = form.querySelector('#image-file')
  const save = form.querySelector('.save')
  let blob = item?.blob || null
  let imageUrl = item?.image || ''
  let tempUrl
  let revision = 0
  let saving = false
  let checking = false
  function drawPreview() {
    preview.replaceChildren()
    if (imageUrl) preview.append(printCard({ image: imageUrl, date: fields.date.value, alt: '選んだ写真のプレビュー' }))
    drop.hidden = Boolean(imageUrl)
    replace.hidden = !imageUrl
    fileInput.tabIndex = imageUrl ? -1 : 0
    save.disabled = !blob || checking || saving
  }
  async function selectFile(file) {
    if (!file || saving) return
    const request = ++revision
    checking = true
    save.disabled = true
    errorText.textContent = '画像を確認しています…'
    try {
      const photo = await readablePhoto(file)
      if (revision !== request) return
      if (tempUrl) URL.revokeObjectURL(tempUrl)
      blob = photo
      tempUrl = URL.createObjectURL(photo)
      imageUrl = tempUrl
      errorText.textContent = ''
    } catch (error) {
      if (revision === request) errorText.textContent = error.message
    } finally {
      if (revision === request) { checking = false; drawPreview() }
    }
  }
  fileInput.addEventListener('change', () => { selectFile(fileInput.files[0]); fileInput.value = '' })
  replace.addEventListener('click', () => fileInput.click())
  const area = form.querySelector('.upload-area')
  area.addEventListener('dragover', event => { event.preventDefault(); area.classList.add('dragging') })
  area.addEventListener('dragleave', () => area.classList.remove('dragging'))
  area.addEventListener('drop', event => {
    event.preventDefault()
    area.classList.remove('dragging')
    selectFile(event.dataTransfer.files[0])
  })
  fields.date.addEventListener('input', () => {
    const date = preview.querySelector('.print-date')
    if (date) date.textContent = dateLabel(fields.date.value)
  })
  form.querySelector('.cancel').onclick = () => onCancel ? onCancel() : closeDialog()
  form.onsubmit = async event => {
    event.preventDefault()
    if (saving || checking || !blob) return
    saving = true
    setBusy(true)
    form.inert = true
    save.textContent = '保存中…'
    try {
      const now = new Date().toISOString()
      const record = {
        id: item?.id || 'personal-' + crypto.randomUUID(),
        source: 'personal', image: blob, date: fields.date.value,
        location: fields.location.value.trim(), comment: fields.comment.value.trim(),
        tags: [...new Set(fields.tags.value.split(/[、,，]/u).map(tag => tag.trim()).filter(Boolean))],
        createdAt: item?.createdAt || now, updatedAt: now,
      }
      await saveMemory(record, item)
      await onSaved(record.id)
      notify(item ? '変更を保存しました。' : '思い出を追加しました。')
    } catch (error) { errorText.textContent = storageMessage(error) }
    finally { saving = false; setBusy(false); form.inert = false; save.textContent = '保存'; if (form.isConnected) drawPreview() }
  }
  drawPreview()
  showDialog(item ? '思い出を編集' : '写真を追加', form, {
    trigger,
    leave: () => { revision++; if (tempUrl) URL.revokeObjectURL(tempUrl) },
  })
}

export function confirmDeletion(item, onDeleted, onCancel) {
  if (item.source !== 'personal') return
  const panel = template(`<div class="confirm-panel"><p>削除した写真は元に戻せません。</p>
    <p class="error" role="alert"></p><div class="actions"><button class="secondary">キャンセル</button><button class="danger">削除する</button></div></div>`)
  panel.querySelector('.secondary').onclick = onCancel
  panel.querySelector('.danger').onclick = async () => {
    setBusy(true)
    panel.inert = true
    try {
      await deleteMemory(item)
      await onDeleted()
      setBusy(false)
      closeDialog()
      notify('思い出を削除しました。')
    } catch (error) { panel.querySelector('.error').textContent = storageMessage(error) }
    finally { setBusy(false); panel.inert = false }
  }
  showDialog('この思い出を削除しますか？', panel)
}
