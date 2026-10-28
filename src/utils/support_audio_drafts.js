/** Audios locales por usuario y ticket. Nunca se guardan tokens ni se envían borradores solos. */
let database_promise = null

export function new_audio_id() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return 'audio_' + Date.now() + '_' + Math.random().toString(36).slice(2)
}

function database() {
  if (!database_promise) {
    database_promise = new Promise(function (resolve, reject) {
      if (!globalThis.indexedDB) { reject(new Error('El navegador no permite guardar audios localmente.')); return }
      const request = indexedDB.open('comerciocity-support-audio', 1)
      const timeout = setTimeout(function () { reject(new Error('El almacenamiento del navegador no respondió.')) }, 5000)
      request.onupgradeneeded = function () { request.result.createObjectStore('drafts', { keyPath: 'id' }) }
      request.onsuccess = function () { clearTimeout(timeout); resolve(request.result) }
      request.onerror = function () { clearTimeout(timeout); reject(request.error) }
      request.onblocked = function () { clearTimeout(timeout); reject(new Error('Cerrá otras pestañas del admin y probá de nuevo.')) }
    }).catch(function (error) { database_promise = null; throw error })
  }
  return database_promise
}

function transact(mode, operation) {
  return database().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction('drafts', mode)
      const request = operation(tx.objectStore('drafts'))
      const timeout = setTimeout(function () {
        try { tx.abort() } catch (err) { /* ya terminó */ }
        reject(new Error('No se pudo confirmar el guardado local del audio.'))
      }, 5000)
      // El éxito de put() todavía NO confirma persistencia: esperar el commit de la transacción.
      tx.oncomplete = function () { clearTimeout(timeout); resolve(request && request.result) }
      tx.onerror = tx.onabort = function () { clearTimeout(timeout); reject(tx.error || new Error('No se pudo guardar el audio.')) }
    })
  })
}

export function save_audio_draft(draft) {
  return transact('readwrite', function (store) { return store.put(draft) })
}

export function remove_audio_draft(id) {
  return transact('readwrite', function (store) { return store.delete(id) })
}

export function load_audio_drafts(scope) {
  return transact('readonly', function (store) { return store.getAll() }).then(function (rows) {
    return rows.filter(function (row) { return row.scope === scope && row.blob && row.blob.size > 0 })
      .sort(function (a, b) { return b.updated_at - a.updated_at })
  })
}

export function check_audio_storage() {
  const id = 'probe_' + new_audio_id()
  return save_audio_draft({ id: id, blob: new Blob(['prueba']), scope: 'probe' })
    .then(function () { return remove_audio_draft(id) })
}
