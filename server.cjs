const http = require('node:http')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFile, spawn } = require('node:child_process')
const { createCompanion, searchGemini } = require('./companion.cjs')

const HOST = '127.0.0.1'
const PORT = Number(process.env.INKLEAF_PORT || 43128)
const APP_ROOT = __dirname
const STATIC_ROOT = path.join(APP_ROOT, 'dist')
const CONFIG_ROOT = process.env.INKLEAF_CONFIG_DIR || process.env.INKSTONE_CONFIG_DIR || path.join(process.env.LOCALAPPDATA || APP_ROOT, 'Inkleaf')
const SETTINGS_PATH = path.join(CONFIG_ROOT, 'settings.json')
const LEGACY_SETTINGS_PATHS = [
  path.join(process.env.LOCALAPPDATA || '', '\u58a8\u9875\u9605\u8bfb\u7f51\u9875', 'settings.json'),
  path.join(process.env.APPDATA || '', 'inkstone-reader', 'settings.json'),
]
const LIBRARY_INDEX = 'library.json'
const LEGACY_LIBRARY_INDEX = '\u58a8\u9875\u4e66\u5e93.json'
const BOOKS_DIRECTORY = 'books'
const LEGACY_BOOKS_DIRECTORY = '\u4e66\u7c4d'
const NOTES_DIRECTORY = 'notes'
const LEGACY_NOTES_DIRECTORY = '\u7b14\u8bb0'
const POWERSHELL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const stateWriteQueues = new Map()
const companion = createCompanion({
  requestModel, settings: readSettingsRaw, searchWeb: searchGemini,
  directoryFor: async (bookId) => {
    validateBookId(bookId)
    const books = await readLibraryIndex()
    if (!books.some(book => book.id === bookId)) throw new Error('This book is not in the library.')
    return pathInside(await libraryRoot(), NOTES_DIRECTORY, bookId, '.ai')
  },
})

const mimeTypes = {
  '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.pdf': 'application/pdf',
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target))
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

async function readSettingsRaw() {
  for (const filename of [SETTINGS_PATH, ...LEGACY_SETTINGS_PATHS]) {
    try { return JSON.parse(await fsp.readFile(filename, 'utf8')) } catch {}
  }
  return {}
}

async function writeSettings(next) {
  const current = await readSettingsRaw()
  const merged = { ...current, ...next }
  if (!next.apiKey) merged.apiKey = current.apiKey || ''
  await fsp.mkdir(CONFIG_ROOT, { recursive: true })
  const temporary = `${SETTINGS_PATH}.tmp`
  await fsp.writeFile(temporary, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  await fsp.rename(temporary, SETTINGS_PATH)
  return merged
}

function publicSettings(settings) {
  const { apiKey, ...safe } = settings
  return { ...safe, hasApiKey: Boolean(apiKey) }
}

function endpointFor(baseUrl) {
  const clean = String(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  if (/generativelanguage\.googleapis\.com/i.test(clean) && !/\/openai(?:\/|$)/i.test(clean)) {
    return `${clean}/openai/chat/completions`
  }
  return clean.endsWith('/chat/completions') ? clean : `${clean}/chat/completions`
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 5000)
  return [0, 800, 2000][attempt] || 2000
}

function targetLanguageName(value) {
  const requested = String(value || 'English').trim()
  if (/^(chinese|simplified chinese|zh|zh-cn|\u4e2d\u6587|\u7b80\u4f53\u4e2d\u6587)$/i.test(requested)) return 'Simplified Chinese'
  return requested || 'English'
}

async function requestModel({ messages, temperature, override = {}, timeoutMs = 60000 }) {
  const saved = await readSettingsRaw()
  const config = { ...saved, ...override }
  const apiKey = override.apiKey || saved.apiKey
  if (!apiKey) throw new Error('Add an API key in Settings first.')
  const retryableStatuses = new Set([429, 500, 502, 503, 504])
  const maximumAttempts = 3
  let lastError

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(endpointFor(config.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: config.model || 'gpt-4.1-mini', temperature, messages }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        const content = data?.choices?.[0]?.message?.content
        if (!content) throw new Error('The API returned no content. Check the model configuration.')
        return String(content).trim()
      }

      const providerMessage = data?.error?.message || `API request failed (${response.status}).`
      lastError = new Error(providerMessage)
      if (!retryableStatuses.has(response.status) || attempt === maximumAttempts - 1) {
        if (response.status === 503) {
          throw new Error(`The AI provider is temporarily unavailable (503) after ${maximumAttempts} attempts. Please try again shortly.`)
        }
        throw lastError
      }
      await delay(retryDelay(response, attempt))
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The request timed out. Check the network and API base URL.')
      if (attempt === maximumAttempts - 1 || !/fetch failed|network|socket|ECONNRESET|ETIMEDOUT/i.test(error.message || '')) throw error
      lastError = error
      await delay([300, 800, 2000][attempt])
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError || new Error('The AI request failed.')
}

async function translateText(text, override = {}) {
  const config = { ...(await readSettingsRaw()), ...override }
  const targetLanguage = targetLanguageName(config.targetLanguage)
  return requestModel({
    override,
    temperature: 0.1,
    timeoutMs: 45000,
    messages: [
      { role: 'system', content: `You are a meticulous professional translator of literature and serious nonfiction. Translate the user's text into ${targetLanguage}.

Requirements:
1. Preserve the exact meaning, logical relationships, tone, register, tense, person, modality, ambiguity, and degree of certainty.
2. Do not omit, summarize, embellish, explain, censor, or add information that is absent from the source.
3. Translate terminology and proper nouns accurately and consistently. When context is insufficient, choose the least speculative rendering.
4. Produce natural, polished ${targetLanguage} while remaining faithful to the source sentence structure where it carries meaning.
5. Preserve paragraph breaks, headings, lists, quotations, emphasis, and other meaningful formatting.
6. If the source is an incomplete sentence or fragment, translate it as a fragment. Do not invent missing context or silently repair it.
7. Return only the translation. Do not add labels, notes, alternatives, commentary, or quotation marks.` },
      { role: 'user', content: String(text || '') },
    ],
  })
}

async function askReaderAI({ messages = [], context = '' }) {
  const config = await readSettingsRaw()
  const clean = messages.filter((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-14).map(({ role, content }) => ({ role, content: content.slice(0, 10000) }))
  if (!clean.length) throw new Error('Enter a question to discuss with the AI reading companion.')
  return requestModel({
    temperature: 0.55,
    messages: [
      { role: 'system', content: `You are an insightful, grounded reading companion. Discuss the book, selected passages, and notes supplied by the reader. You may explain, ask follow-up questions, compare ideas, offer counterexamples, and organize arguments, but never pretend to know parts of the book that were not provided. Be clear and specific. Respond in ${config.targetLanguage || 'English'}.${context ? `\n\nCurrent reading context:\n${String(context).slice(0, 14000)}` : ''}` },
      ...clean,
    ],
  })
}

async function libraryRoot(required = true) {
  const settings = await readSettingsRaw()
  const configured = typeof settings.libraryPath === 'string' ? settings.libraryPath.trim() : ''
  if (!configured && required) throw new Error('Choose a library folder first.')
  return configured ? path.resolve(configured) : ''
}

function pathInside(root, ...parts) {
  const target = path.resolve(root, ...parts)
  if (!inside(root, target)) throw new Error('The target path is outside the library.')
  return target
}

function validateBookId(bookId) {
  if (!/^[a-f0-9]{20}$/.test(bookId || '')) throw new Error('Invalid book ID.')
}

async function pathExists(target) {
  try { await fsp.access(target); return true } catch { return false }
}

async function migrateLegacyLibrary(root) {
  const legacyBooks = pathInside(root, LEGACY_BOOKS_DIRECTORY)
  const books = pathInside(root, BOOKS_DIRECTORY)
  const legacyNotes = pathInside(root, LEGACY_NOTES_DIRECTORY)
  const notes = pathInside(root, NOTES_DIRECTORY)
  const legacyIndex = pathInside(root, LEGACY_LIBRARY_INDEX)
  const index = pathInside(root, LIBRARY_INDEX)

  if (await pathExists(legacyBooks)) {
    if (await pathExists(books)) throw new Error('Both legacy and standard books directories exist. Merge them before continuing.')
    await fsp.rename(legacyBooks, books)
  }
  if (await pathExists(legacyNotes)) {
    if (await pathExists(notes)) throw new Error('Both legacy and standard notes directories exist. Merge them before continuing.')
    await fsp.rename(legacyNotes, notes)
  }
  if (await pathExists(legacyIndex)) {
    if (!(await pathExists(index))) {
      const source = await fsp.readFile(legacyIndex, 'utf8')
      const data = JSON.parse(source)
      const normalized = Array.isArray(data.books) ? data.books.map((book) => ({
        ...book,
        bookFile: String(book.bookFile || '').replace(/^[^/\\]+[/\\]/, `${BOOKS_DIRECTORY}/`),
      })) : []
      await fsp.writeFile(pathInside(root, 'library.legacy-backup.json'), source, 'utf8')
      await fsp.writeFile(index, `${JSON.stringify({ version: 3, books: normalized }, null, 2)}\n`, 'utf8')
    }
    await fsp.rm(legacyIndex, { force: true })
  }
}

async function ensureLibrary(root) {
  await migrateLegacyLibrary(root)
  await fsp.mkdir(pathInside(root, BOOKS_DIRECTORY), { recursive: true })
  await fsp.mkdir(pathInside(root, NOTES_DIRECTORY), { recursive: true })
}

async function readLibraryIndex() {
  const root = await libraryRoot(false)
  if (!root) return []
  try {
    await ensureLibrary(root)
    const data = JSON.parse(await fsp.readFile(pathInside(root, LIBRARY_INDEX), 'utf8'))
    return Array.isArray(data.books) ? data.books : []
  } catch { return [] }
}

async function writeLibraryIndex(books) {
  const root = await libraryRoot()
  await ensureLibrary(root)
  const target = pathInside(root, LIBRARY_INDEX)
  const temporary = `${target}.tmp`
  await fsp.writeFile(temporary, `${JSON.stringify({ version: 3, books }, null, 2)}\n`, 'utf8')
  await fsp.rename(temporary, target)
}

async function stateFileFor(bookId) {
  validateBookId(bookId)
  const root = await libraryRoot()
  const directory = pathInside(root, NOTES_DIRECTORY, bookId)
  await fsp.mkdir(directory, { recursive: true })
  return path.join(directory, 'notebook.json')
}

async function importBookData(name, data) {
  if (!/\.(epub|pdf)$/i.test(name || '')) throw new Error('Choose an EPUB or PDF file.')
  if (!data.length) throw new Error('The book file is empty.')
  const format = path.extname(name).slice(1).toLowerCase()
  if (format === 'pdf' && !data.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('This file does not contain a valid PDF header.')
  const id = crypto.createHash('sha256').update(data).digest('hex').slice(0, 20)
  const books = await readLibraryIndex()
  const existing = books.find((book) => book.id === id)
  if (existing) {
    existing.lastOpenedAt = Date.now()
    await writeLibraryIndex(books)
    return { ...existing, dataBase64: data.toString('base64') }
  }
  const root = await libraryRoot()
  await ensureLibrary(root)
  const cleanName = name.replace(/\.(epub|pdf)$/i, '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '').slice(0, 90) || 'Untitled book'
  const bookFile = `${BOOKS_DIRECTORY}/${cleanName}--${id.slice(0, 6)}.${format}`
  await fsp.writeFile(pathInside(root, bookFile), data)
  await fsp.writeFile(await stateFileFor(id), JSON.stringify({ notes: [], translations: [], aiMessages: [], location: '' }, null, 2), 'utf8')
  const now = Date.now()
  const entry = { id, name, format, title: name.replace(/\.(epub|pdf)$/i, ''), creator: '', size: data.length, importedAt: now, lastOpenedAt: now, noteCount: 0, progress: 0, bookFile }
  books.unshift(entry)
  await writeLibraryIndex(books)
  return { ...entry, dataBase64: data.toString('base64') }
}

async function openLibraryBook(bookId) {
  const books = await readLibraryIndex()
  const entry = books.find((book) => book.id === bookId)
  if (!entry) throw new Error('This book is not in the library.')
  const root = await libraryRoot()
  const data = await fsp.readFile(pathInside(root, entry.bookFile))
  entry.lastOpenedAt = Date.now()
  await writeLibraryIndex(books)
  return { ...entry, dataBase64: data.toString('base64') }
}

async function readBookState(bookId) {
  try { return JSON.parse(await fsp.readFile(await stateFileFor(bookId), 'utf8')) }
  catch { return { notes: [], translations: [], aiMessages: [], location: '' } }
}

async function saveBookState(bookId, patch) {
  const current = await readBookState(bookId)
  const next = { ...current, ...patch, updatedAt: Date.now() }
  const target = await stateFileFor(bookId)
  const temporary = `${target}.tmp`
  await fsp.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  await fsp.rename(temporary, target)
  const books = await readLibraryIndex()
  const entry = books.find((book) => book.id === bookId)
  if (entry) {
    if (Array.isArray(next.notes)) entry.noteCount = next.notes.length
    if (typeof next.progress === 'number') entry.progress = next.progress
    await writeLibraryIndex(books)
  }
  return next
}

function queueBookStateSave(bookId, patch) {
  const previous = stateWriteQueues.get(bookId) || Promise.resolve()
  const next = previous.catch(() => {}).then(() => saveBookState(bookId, patch))
  stateWriteQueues.set(bookId, next)
  next.finally(() => { if (stateWriteQueues.get(bookId) === next) stateWriteQueues.delete(bookId) }).catch(() => {})
  return next
}

function runDialog(script, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    execFile(POWERSHELL, ['-NoProfile', '-STA', '-Command', script], {
      windowsHide: true,
      encoding: 'utf8',
      env: { ...process.env, ...extraEnv },
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message).trim()))
      else resolve(String(stdout || '').trim() || null)
    })
  })
}

async function chooseLibraryFolder() {
  const current = await libraryRoot(false)
  return runDialog("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Choose an Inkleaf library folder'; $d.ShowNewFolderButton=$true; if(Test-Path -LiteralPath $env:INKSTONE_DEFAULT_PATH){$d.SelectedPath=$env:INKSTONE_DEFAULT_PATH}; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($d.SelectedPath)}", { INKSTONE_DEFAULT_PATH: current || process.env.USERPROFILE || '' })
}

function chooseEpubFile() {
  return runDialog("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Import a book into Inkleaf'; $d.Filter='Books (*.epub;*.pdf)|*.epub;*.pdf|EPUB (*.epub)|*.epub|PDF (*.pdf)|*.pdf'; $d.Multiselect=$false; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($d.FileName)}")
}

function chooseSaveFile(defaultName) {
  return runDialog("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.SaveFileDialog; $d.Title='Export reading notes'; $d.Filter='Markdown (*.md)|*.md|Plain text (*.txt)|*.txt'; $d.FileName=$env:INKSTONE_DEFAULT_NAME; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($d.FileName)}", { INKSTONE_DEFAULT_NAME: defaultName || 'reading-notes.md' })
}

function sendJson(response, statusCode, value, error) {
  const body = Buffer.from(JSON.stringify(error ? { ok: false, error } : { ok: true, value }))
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(body)
}

async function requestJson(request, limit = 2 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('The request body is too large.'), { statusCode: 413 })
    chunks.push(chunk)
  }
  if (!size) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw Object.assign(new Error('The request body is not valid JSON.'), { statusCode: 400 }) }
}

function safeMutation(request) {
  const origin = request.headers.origin
  return request.headers['x-inkstone-web'] === '1' && (!origin || origin === `http://${HOST}:${PORT}` || origin === `http://localhost:${PORT}`)
}

async function handleApi(request, response, url) {
  if (request.method !== 'GET' && !safeMutation(request)) return sendJson(response, 403, null, 'Request origin rejected.')
  if (request.method === 'GET' && url.pathname === '/inkstone-api/health') return sendJson(response, 200, { runtime: 'local-web', version: '0.6.0' })
  if (request.method === 'GET' && url.pathname === '/inkstone-api/library') return sendJson(response, 200, await readLibraryIndex())
  if (request.method === 'GET' && url.pathname === '/inkstone-api/library/path') return sendJson(response, 200, await libraryRoot(false))
  if (request.method === 'POST' && url.pathname === '/inkstone-api/library/choose') {
    const selected = await chooseLibraryFolder()
    if (!selected) return sendJson(response, 200, null)
    await writeSettings({ libraryPath: path.resolve(selected) })
    await ensureLibrary(path.resolve(selected))
    return sendJson(response, 200, { path: path.resolve(selected), books: await readLibraryIndex() })
  }
  if (request.method === 'POST' && url.pathname === '/inkstone-api/library/show-folder') {
    const root = await libraryRoot()
    await ensureLibrary(root)
    spawn('explorer.exe', [root], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
    return sendJson(response, 200, '')
  }
  if (request.method === 'POST' && url.pathname === '/inkstone-api/library/import') {
    const filename = await chooseEpubFile()
    if (!filename) return sendJson(response, 200, null)
    return sendJson(response, 200, await importBookData(path.basename(filename), await fsp.readFile(filename)))
  }
  if (request.method === 'POST' && url.pathname === '/inkstone-api/library/import-bytes') {
    const body = await requestJson(request, 300 * 1024 * 1024)
    return sendJson(response, 200, await importBookData(body.name, Buffer.from(body.dataBase64 || '', 'base64')))
  }
  if (request.method === 'POST' && url.pathname === '/inkstone-api/library/metadata') {
    const body = await requestJson(request)
    const books = await readLibraryIndex()
    const entry = books.find((book) => book.id === body.id)
    if (!entry) return sendJson(response, 200, null)
    if (body.title) entry.title = body.title
    entry.creator = body.creator || ''
    await writeLibraryIndex(books)
    return sendJson(response, 200, entry)
  }
  const bookMatch = url.pathname.match(/^\/inkstone-api\/library\/([a-f0-9]{20})(?:\/(open|state))?$/)
  if (bookMatch) {
    const [, bookId, action] = bookMatch
    if (request.method === 'GET' && action === 'open') return sendJson(response, 200, await openLibraryBook(bookId))
    if (request.method === 'GET' && action === 'state') return sendJson(response, 200, await readBookState(bookId))
    if (request.method === 'POST' && action === 'state') return sendJson(response, 200, await queueBookStateSave(bookId, await requestJson(request, 20 * 1024 * 1024)))
    if (request.method === 'DELETE' && !action) {
      if (await companion.isBusy(bookId)) throw new Error('Wait for AI pre-reading or conversation to finish before removing this book.')
      const books = await readLibraryIndex()
      const entry = books.find((book) => book.id === bookId)
      if (!entry) return sendJson(response, 200, false)
      const root = await libraryRoot()
      await fsp.rm(pathInside(root, entry.bookFile), { force: true })
      await fsp.rm(pathInside(root, NOTES_DIRECTORY, bookId), { recursive: true, force: true })
      await writeLibraryIndex(books.filter((book) => book.id !== bookId))
      return sendJson(response, 200, true)
    }
  }
  if (request.method === 'GET' && url.pathname === '/inkstone-api/settings') return sendJson(response, 200, publicSettings(await readSettingsRaw()))
  if (request.method === 'POST' && url.pathname === '/inkstone-api/settings') return sendJson(response, 200, publicSettings(await writeSettings(await requestJson(request))))
  if (request.method === 'POST' && url.pathname === '/inkstone-api/translate') {
    const body = await requestJson(request)
    return sendJson(response, 200, await translateText(body.text))
  }
  if (request.method === 'POST' && url.pathname === '/inkstone-api/translate/test') {
    const settings = await requestJson(request)
    return sendJson(response, 200, { ok: true, result: await translateText('A quiet page can hold an entire world.', settings) })
  }
  const companionMatch = url.pathname.match(/^\/inkstone-api\/companion\/([a-f0-9]{20})$/)
  if (companionMatch && request.method === 'GET') return sendJson(response, 200, await companion.status(companionMatch[1]))
  if (companionMatch && request.method === 'POST') {
    const body = await requestJson(request, 64 * 1024 * 1024)
    if (body.action === 'pause') return sendJson(response, 200, await companion.pause(companionMatch[1]))
    return sendJson(response, 200, await companion.start(companionMatch[1], body.chapters))
  }
  if (request.method === 'POST' && url.pathname === '/inkstone-api/ai') {
    const body = await requestJson(request, 2 * 1024 * 1024)
    return sendJson(response, 200, body.bookId ? await companion.chat(body) : await askReaderAI(body))
  }
  if (request.method === 'POST' && url.pathname === '/inkstone-api/notes/export') {
    const body = await requestJson(request, 20 * 1024 * 1024)
    const filename = await chooseSaveFile(body.filename)
    if (!filename) return sendJson(response, 200, null)
    await fsp.writeFile(filename, String(body.content || ''), 'utf8')
    return sendJson(response, 200, filename)
  }
  return sendJson(response, 404, null, 'Local API endpoint not found.')
}

async function serveStatic(request, response, url) {
  let pathname
  try { pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname) }
  catch { response.writeHead(400); response.end(); return }
  let filename = path.resolve(STATIC_ROOT, `.${pathname}`)
  if (!inside(STATIC_ROOT, filename)) { response.writeHead(403); response.end(); return }
  try { if (!(await fsp.stat(filename)).isFile()) throw new Error('not file') }
  catch { filename = path.join(STATIC_ROOT, 'index.html') }
  const body = await fsp.readFile(filename)
  const cache = /\.(html|js)$/.test(filename) ? 'no-cache' : 'public, max-age=31536000, immutable'
  response.writeHead(200, {
    'Content-Type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; frame-src blob:; worker-src 'self' blob:; font-src 'self' data: blob:",
  })
  if (request.method === 'HEAD') response.end()
  else response.end(body)
}

function openBrowser() {
  const edgeCandidates = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]
  const edge = edgeCandidates.find((candidate) => candidate && fs.existsSync(candidate))
  const url = `http://${HOST}:${PORT}/`
  if (edge) spawn(edge, [`--app=${url}`, '--start-maximized'], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
  else spawn('explorer.exe', [url], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
}

async function existingServer() {
  try {
    const response = await fetch(`http://${HOST}:${PORT}/inkstone-api/health`, { signal: AbortSignal.timeout(900) })
    const data = await response.json()
    return response.ok && data?.value?.runtime === 'local-web'
  } catch { return false }
}

async function main() {
  if (await existingServer()) {
    if (process.argv.includes('--open')) openBrowser()
    return
  }
  if (!fs.existsSync(path.join(STATIC_ROOT, 'index.html'))) throw new Error('The web interface files are missing.')
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${HOST}:${PORT}`)
      if (url.pathname.startsWith('/inkstone-api/')) await handleApi(request, response, url)
      else if (request.method === 'GET' || request.method === 'HEAD') await serveStatic(request, response, url)
      else sendJson(response, 405, null, 'Method not allowed.')
    } catch (error) {
      if (!response.headersSent) sendJson(response, error.statusCode || 500, null, error.message || 'Local server error.')
      else response.end()
    }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, HOST, resolve) })
  if (process.argv.includes('--open')) openBrowser()
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
