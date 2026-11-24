// Run this script only from DevTools on the original loopback frontend origin.
;(() => {
  const legacyName = 'gaso-document-ai'
  const stores = ['drafts', 'pages', 'images', 'collections', 'savedDocuments', 'storageSync']
  const marker = 'legacyAssignment'
  const metadata = 'accountMeta'

  const read = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

  function open(name, version) {
    const request = indexedDB.open(name, version)
    request.onupgradeneeded = () => {
      if (version === undefined) {
        request.transaction.abort()
        return
      }
      const db = request.result
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(metadata)) db.createObjectStore(metadata)
    }
    return read(request)
  }

  function complete(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onabort = () => reject(tx.error || new Error('IndexedDB darbība atcelta.'))
    })
  }

  async function identity(email) {
    const response = await fetch('/api/auth/me', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('Pieslēdzieties izvēlētajam kontam.')
    const account = await response.json()
    if (account.email !== email || !/^[a-f0-9]{24}$/.test(account.id)) {
      throw new Error('Pārbaudītā sesija neatbilst norādītajam kontam.')
    }
    return account
  }

  async function readSource(name, owner, databases) {
    if (!databases.some(({ name: existing }) => existing === name)) {
      throw new Error('Šajā pārlūka profilā un adresē nav vecās glabātuves.')
    }
    const db = await open(name)
    try {
      const available = stores.filter((store) => db.objectStoreNames.contains(store))
      const hasMarker = db.objectStoreNames.contains(metadata)
      const tx = db.transaction(hasMarker ? [...available, metadata] : available)
      const claim = hasMarker ? read(tx.objectStore(metadata).get(marker)) : null
      const source = await Promise.all(
        available.map((store) => read(tx.objectStore(store).getAll())),
      )
      if ((await claim) && (await claim) !== owner) {
        throw new Error('Vecā glabātuve jau ir rezervēta citam kontam.')
      }
      return Object.fromEntries(available.map((store, index) => [store, source[index]]))
    } finally {
      db.close()
    }
  }

  async function claimSource(owner) {
    const db = await open(legacyName, 4)
    try {
      const tx = db.transaction(metadata, 'readwrite')
      const done = complete(tx)
      const store = tx.objectStore(metadata)
      const existing = await read(store.get(marker))
      if (existing && existing !== owner) {
        await done
        throw new Error('Vecā glabātuve jau ir rezervēta citam kontam.')
      }
      store.put(owner, marker)
      await done
    } finally {
      db.close()
    }
  }

  async function targetState(name, owner, apply, data, databases) {
    if (!apply && !databases.some(({ name: existing }) => existing === name)) return 'empty'
    const db = await open(name, apply ? 4 : undefined)
    try {
      const tx = db.transaction([...stores, metadata], apply ? 'readwrite' : 'readonly')
      const done = complete(tx)
      const state = read(tx.objectStore(metadata).get(marker))
      const counts = await Promise.all(stores.map((store) => read(tx.objectStore(store).count())))
      const migrated = (await state) === owner
      if (migrated || counts.some(Boolean)) {
        await done
        return migrated ? 'assigned' : 'occupied'
      }
      if (apply) {
        for (const [store, entries] of Object.entries(data)) {
          for (const entry of entries) tx.objectStore(store).add(entry)
        }
        tx.objectStore(metadata).put(owner, marker)
      }
      await done
      return apply ? 'assigned' : 'empty'
    } finally {
      db.close()
    }
  }

  globalThis.assignGasoLegacyIndexedDb = async (email, { apply = false } = {}) => {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      throw new Error('Migrācijas rīks darbojas tikai lokālajā adresē.')
    }
    email = email.trim().toLowerCase()
    if (apply && !navigator.locks) throw new Error('Migrācijai nepieciešams Web Locks atbalsts.')
    const run = async () => {
      const { id } = await identity(email)
      const databases = await indexedDB.databases()
      const target = legacyName + ':account:' + id
      const data = await readSource(legacyName, id, databases)
      const state = await targetState(target, id, false, data, databases)
      const counts = Object.fromEntries(
        Object.entries(data).map(([store, entries]) => [store, entries.length]),
      )
      if (!apply || state === 'assigned') return { email, dryRun: !apply, state, counts }
      if (state === 'occupied') throw new Error('Izvēlētā konta lokālajai glabātuvei jābūt tukšai.')
      if ((await identity(email)).id !== id) throw new Error('Sesija ir mainījusies.')
      await claimSource(id)
      const result = await targetState(target, id, true, data, databases)
      if (result !== 'assigned')
        throw new Error('Konta lokālā glabātuve migrācijas laikā mainījās.')
      return { email, dryRun: false, state: result, counts }
    }
    return apply ? navigator.locks.request('gaso-legacy-indexeddb-assignment', run) : run()
  }
})()
