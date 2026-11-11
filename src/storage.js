const storeName = 'memories'
let connection
let storeImageBytes = false

function database() {
  if (connection) return connection
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('re-day', 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' })
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); connection = null }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('別のタブのre:dayを閉じ、もう一度お試しください。'))
  }).catch(error => { connection = null; throw error })
  return connection
}

export async function allPersonal() {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result.map(record => {
      if (record.image instanceof Blob) return record
      return { ...record, image: new Blob([record.image], { type: record.imageType }) }
    }))
    request.onerror = () => reject(request.error)
  })
}

// 回答を返すのは個々のリクエスト成功時ではなく、トランザクションの確定後。
async function write(operation) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    let reason
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(reason || tx.error || new Error('保存が中断されました。'))
    const abort = error => { reason = error; tx.abort() }
    try { operation(tx.objectStore(storeName), abort) } catch (error) { abort(error) }
  })
}

// WebKitの一部の保存領域ではBlobを書き込めないため、同じバイト列を保存する。
async function withWritableImages(records, operation) {
  if (!storeImageBytes) {
    try { return await operation(records) }
    catch (error) {
      if (!['UnknownError', 'DataCloneError'].includes(error?.name)) throw error
    }
  }
  const converted = await Promise.all(records.map(async record => ({
    ...record, image: await record.image.arrayBuffer(), imageType: record.image.type,
  })))
  const result = await operation(converted)
  storeImageBytes = true
  return result
}

export function saveMemory(memory, previous) {
  return withWritableImages([memory], ([record]) => write((store, abort) => {
    if (!previous) { store.add(record); return }
    const request = store.get(record.id)
    request.onsuccess = () => {
      if (request.result?.updatedAt !== previous.updatedAt) {
        abort(new Error('この写真は別の画面で変更されました。詳細を開き直してください。'))
      } else { store.put(record) }
    }
  }))
}

export function deleteMemory(record) {
  return write((store, abort) => {
    const request = store.get(record.id)
    request.onsuccess = () => {
      if (request.result?.updatedAt !== record.updatedAt) {
        abort(new Error('この写真は別の画面で変更されました。詳細を開き直してください。'))
      } else { store.delete(record.id) }
    }
  })
}

export function restoreMissing(records) {
  return withWritableImages(records, async writable => {
    let added = 0
    await write(store => {
      for (const record of writable) {
        const request = store.getKey(record.id)
        request.onsuccess = () => {
          if (request.result === undefined) { store.add(record); added++ }
        }
      }
    })
    return added
  })
}

export function storageMessage(error) {
  if (error?.name === 'QuotaExceededError') return 'ブラウザの保存容量が足りません。バックアップを取って空き容量を確保してください。'
  if (error instanceof Error && error.name === 'Error') return error.message
  return 'ブラウザに保存できませんでした。ブラウザの設定と空き容量をご確認ください。'
}
