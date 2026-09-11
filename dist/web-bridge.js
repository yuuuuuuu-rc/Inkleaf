(function () {
  const API = '/inkstone-api'

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Inkstone-Web': '1',
        ...(options.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({ error: '本机服务返回了无法识别的内容' }))
    if (!response.ok || !payload.ok) throw new Error(payload.error || `操作失败（${response.status}）`)
    return payload.value
  }

  function bytesToBase64(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
    let binary = ''
    const size = 0x8000
    for (let offset = 0; offset < bytes.length; offset += size) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + size))
    }
    return btoa(binary)
  }

  function hydrateBook(book) {
    if (!book || !book.dataBase64) return book
    const binary = atob(book.dataBase64)
    const data = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index)
    const { dataBase64, ...metadata } = book
    return { ...metadata, data }
  }

  window.inkstone = {
    listLibrary: () => request('/library'),
    chooseLibrary: () => request('/library/choose', { method: 'POST', body: '{}' }),
    importBook: async () => hydrateBook(await request('/library/import', { method: 'POST', body: '{}' })),
    importBookBytes: async ({ name, data }) => hydrateBook(await request('/library/import-bytes', {
      method: 'POST',
      body: JSON.stringify({ name, dataBase64: bytesToBase64(data) }),
    })),
    openLibraryBook: async (bookId) => hydrateBook(await request(`/library/${encodeURIComponent(bookId)}/open`)),
    updateBookMetadata: (payload) => request('/library/metadata', { method: 'POST', body: JSON.stringify(payload) }),
    removeLibraryBook: (bookId) => request(`/library/${encodeURIComponent(bookId)}`, { method: 'DELETE', body: '{}' }),
    getBookState: (bookId) => request(`/library/${encodeURIComponent(bookId)}/state`),
    saveBookState: (bookId, state) => request(`/library/${encodeURIComponent(bookId)}/state`, { method: 'POST', body: JSON.stringify(state) }),
    getLibraryPath: () => request('/library/path'),
    openLibraryFolder: () => request('/library/show-folder', { method: 'POST', body: '{}' }),
    getSettings: () => request('/settings'),
    saveSettings: (settings) => request('/settings', { method: 'POST', body: JSON.stringify(settings) }),
    translate: (payload) => request('/translate', { method: 'POST', body: JSON.stringify(payload) }),
    askReaderAI: (payload) => request('/ai', { method: 'POST', body: JSON.stringify(payload) }),
    testTranslation: (settings) => request('/translate/test', { method: 'POST', body: JSON.stringify(settings) }),
    exportNotes: (payload) => request('/notes/export', { method: 'POST', body: JSON.stringify(payload) }),
  }
})()
