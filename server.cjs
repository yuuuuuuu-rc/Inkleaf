const http = require('node:http')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFile, spawn } = require('node:child_process')

const HOST = '127.0.0.1'
const PORT = 43128
const APP_ROOT = __dirname
const STATIC_ROOT = path.join(APP_ROOT, 'dist')
const CONFIG_ROOT = process.env.INKSTONE_CONFIG_DIR || path.join(process.env.LOCALAPPDATA || APP_ROOT, '墨页阅读网页')
const SETTINGS_PATH = path.join(CONFIG_ROOT, 'settings.json')
const LEGACY_SETTINGS_PATH = path.join(process.env.APPDATA || '', 'inkstone-reader', 'settings.json')
const POWERSHELL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const stateWriteQueues = new Map()

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target))
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

async function readSettingsRaw() {
  for (const filename of [SETTINGS_PATH, LEGACY_SETTINGS_PATH]) {
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

async function requestModel({ messages, temperature, override = {}, timeoutMs = 60000 }) {
  const saved = await readSettingsRaw()
  const config = { ...saved, ...override }
  const apiKey = override.apiKey || saved.apiKey
  if (!apiKey) throw new Error('请先在设置中填写 API Key')
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
    if (!response.ok) throw new Error(data?.error?.message || `接口请求失败（${response.status}）`)
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('接口没有返回内容，请检查模型配置')
    return String(content).trim()
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('请求超时，请检查网络或接口地址')
    throw error
  } finally { clearTimeout(timeout) }
}

async function translateText(text, override = {}) {
  const config = { ...(await readSettingsRaw()), ...override }
  return requestModel({
    override,
    temperature: 0.2,
    timeoutMs: 45000,
    messages: [
      { role: 'system', content: `你是一位专业文学翻译。将用户提供的文本翻译为${config.targetLanguage || '简体中文'}。保留段落、语气、专有名词和排版；只输出译文，不解释。` },
      { role: 'user', content: String(text || '') },
    ],
  })
}

async function askReaderAI({ messages = [], context = '' }) {
  const config = await readSettingsRaw()
  const clean = messages.filter((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-14).map(({ role, content }) => ({ role, content: content.slice(0, 10000) }))
  if (!clean.length) throw new Error('请输入想和 AI 讨论的问题')
  return requestModel({
    temperature: 0.55,
    messages: [
      { role: 'system', content: `你是一位有洞察力但不卖弄的共读伙伴。围绕读者正在阅读的书、选文和便签持续对话。你可以解释、追问、比较、提出反例、整理观点，但不要假装知道未提供的全书内容。回答清晰、具体，默认使用${config.targetLanguage || '简体中文'}。${context ? `\n\n当前阅读上下文：\n${String(context).slice(0, 14000)}` : ''}` },
      ...clean,
    ],
  })
}

async function libraryRoot(required = true) {
  const settings = await readSettingsRaw()
  const configured = typeof settings.libraryPath === 'string' ? settings.libraryPath.trim() : ''
  if (!configured && required) throw new Error('请先选择一个书库文件夹')
  return configured ? path.resolve(configured) : ''
}

function pathInside(root, ...parts) {
  const target = path.resolve(root, ...parts)
  if (!inside(root, target)) throw new Error('目标路径超出书库范围')
  return target
}

function validateBookId(bookId) {
  if (!/^[a-f0-9]{20}$/.test(bookId || '')) throw new Error('无效的书籍编号')
}

async function ensureLibrary(root) {
  await fsp.mkdir(pathInside(root, '书籍'), { recursive: true })
  await fsp.mkdir(pathInside(root, '笔记'), { recursive: true })
}

async function readLibraryIndex() {
  const root = await libraryRoot(false)
  if (!root) return []
  try {
    const data = JSON.parse(await fsp.readFile(pathInside(root, '墨页书库.json'), 'utf8'))
    return Array.isArray(data.books) ? data.books : []
  } catch { return [] }
}

async function writeLibraryIndex(books) {
  const root = await libraryRoot()
  await ensureLibrary(root)
  const target = pathInside(root, '墨页书库.json')
  const temporary = `${target}.tmp`
  await fsp.writeFile(temporary, `${JSON.stringify({ version: 2, books }, null, 2)}\n`, 'utf8')
  await fsp.rename(temporary, target)
}

async function stateFileFor(bookId) {
  validateBookId(bookId)
  const root = await libraryRoot()
  const directory = pathInside(root, '笔记', bookId)
  await fsp.mkdir(directory, { recursive: true })
  return path.join(directory, 'notebook.json')
}

async function importBookData(name, data) {
  if (!/\.epub$/i.test(name || '')) throw new Error('请选择 EPUB 格式的电子书')
  if (!data.length) throw new Error('电子书文件为空')
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
  const cleanName = name.replace(/\.epub$/i, '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '').slice(0, 90) || '未命名书籍'
  const bookFile = path.join('书籍', `${cleanName}--${id.slice(0, 6)}.epub`)
  await fsp.writeFile(pathInside(root, bookFile), data)
  await fsp.writeFile(await stateFileFor(id), JSON.stringify({ notes: [], translations: [], aiMessages: [], location: '' }, null, 2), 'utf8')
  const now = Date.now()
  const entry = { id, name, title: name.replace(/\.epub$/i, ''), creator: '', size: data.length, importedAt: now, lastOpenedAt: now, noteCount: 0, progress: 0, bookFile }
  books.unshift(entry)
  await writeLibraryIndex(books)
  return { ...entry, dataBase64: data.toString('base64') }
}

async function openLibraryBook(bookId) {
  const books = await readLibraryIndex()
  const entry = books.find((book) => book.id === bookId)
  if (!entry) throw new Error('书库中找不到这本书')
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
  return runDialog("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='选择墨页书库文件夹'; $d.ShowNewFolderButton=$true; if(Test-Path -LiteralPath $env:INKSTONE_DEFAULT_PATH){$d.SelectedPath=$env:INKSTONE_DEFAULT_PATH}; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($d.SelectedPath)}", { INKSTONE_DEFAULT_PATH: current || process.env.USERPROFILE || '' })
}

function chooseEpubFile() {
  return runDialog("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='导入 EPUB 到墨页书库'; $d.Filter='EPUB 电子书 (*.epub)|*.epub'; $d.Multiselect=$false; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($d.FileName)}")
}

function chooseSaveFile(defaultName) {
  return runDialog("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.SaveFileDialog; $d.Title='导出阅读笔记'; $d.Filter='Markdown (*.md)|*.md|纯文本 (*.txt)|*.txt'; $d.FileName=$env:INKSTONE_DEFAULT_NAME; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($d.FileName)}", { INKSTONE_DEFAULT_NAME: defaultName || '阅读笔记.md' })
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
    if (size > limit) throw Object.assign(new Error('请求内容过大'), { statusCode: 413 })
    chunks.push(chunk)
  }
  if (!size) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw Object.assign(new Error('请求内容格式错误'), { statusCode: 400 }) }
}

function safeMutation(request) {
  const origin = request.headers.origin
  return request.headers['x-inkstone-web'] === '1' && (!origin || origin === `http://${HOST}:${PORT}` || origin === `http://localhost:${PORT}`)
}

async function handleApi(request, response, url) {
  if (request.method !== 'GET' && !safeMutation(request)) return sendJson(response, 403, null, '来源被拒绝')
  if (request.method === 'GET' && url.pathname === '/inkstone-api/health') return sendJson(response, 200, { runtime: 'local-web', version: '0.4.0' })
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
      const books = await readLibraryIndex()
      const entry = books.find((book) => book.id === bookId)
      if (!entry) return sendJson(response, 200, false)
      const root = await libraryRoot()
      await fsp.rm(pathInside(root, entry.bookFile), { force: true })
      await fsp.rm(pathInside(root, '笔记', bookId), { recursive: true, force: true })
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
  if (request.method === 'POST' && url.pathname === '/inkstone-api/ai') return sendJson(response, 200, await askReaderAI(await requestJson(request, 2 * 1024 * 1024)))
  if (request.method === 'POST' && url.pathname === '/inkstone-api/notes/export') {
    const body = await requestJson(request, 20 * 1024 * 1024)
    const filename = await chooseSaveFile(body.filename)
    if (!filename) return sendJson(response, 200, null)
    await fsp.writeFile(filename, String(body.content || ''), 'utf8')
    return sendJson(response, 200, filename)
  }
  return sendJson(response, 404, null, '本机接口不存在')
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
  const cache = filename.endsWith('index.html') || filename.endsWith('web-bridge.js') ? 'no-cache' : 'public, max-age=31536000, immutable'
  response.writeHead(200, {
    'Content-Type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src blob:; worker-src 'self' blob:; font-src 'self' data:",
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
  if (!fs.existsSync(path.join(STATIC_ROOT, 'index.html'))) throw new Error('找不到网页界面文件')
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${HOST}:${PORT}`)
      if (url.pathname.startsWith('/inkstone-api/')) await handleApi(request, response, url)
      else if (request.method === 'GET' || request.method === 'HEAD') await serveStatic(request, response, url)
      else sendJson(response, 405, null, '不支持此操作')
    } catch (error) {
      if (!response.headersSent) sendJson(response, error.statusCode || 500, null, error.message || '本机服务异常')
      else response.end()
    }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, HOST, resolve) })
  if (process.argv.includes('--open')) openBrowser()
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
