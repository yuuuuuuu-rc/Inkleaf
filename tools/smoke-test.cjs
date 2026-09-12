const { spawn } = require('node:child_process')
const { access, mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PORT = 43281
const URL = `http://127.0.0.1:${PORT}`

async function pathExists(filename) {
  try { await access(filename); return true } catch { return false }
}

async function waitForServer(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${URL}/inkstone-api/health`)
      if (response.ok) return response.json()
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  throw new Error('Timed out waiting for the local server')
}

async function main() {
  const configDir = await mkdtemp(path.join(os.tmpdir(), 'inkleaf-smoke-'))
  const libraryDir = path.join(configDir, 'legacy-library')
  const legacyBooks = path.join(libraryDir, '\u4e66\u7c4d')
  const legacyNotes = path.join(libraryDir, '\u7b14\u8bb0', '0123456789abcdefabcd')
  await mkdir(legacyBooks, { recursive: true })
  await mkdir(legacyNotes, { recursive: true })
  await writeFile(path.join(legacyBooks, 'sample.epub'), Buffer.from('fixture'))
  await writeFile(path.join(legacyNotes, 'notebook.json'), '{"notes":[]}')
  await writeFile(path.join(libraryDir, '\u58a8\u9875\u4e66\u5e93.json'), JSON.stringify({
    version: 2,
    books: [{ id: '0123456789abcdefabcd', title: 'Sample', bookFile: '\u4e66\u7c4d/sample.epub' }],
  }))
  await writeFile(path.join(configDir, 'settings.json'), JSON.stringify({ libraryPath: libraryDir }))
  const child = spawn(process.execPath, [path.join(ROOT, 'server.cjs')], {
    cwd: ROOT,
    env: { ...process.env, INKLEAF_PORT: String(PORT), INKLEAF_CONFIG_DIR: configDir },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  try {
    const health = await waitForServer()
    const page = await fetch(`${URL}/`)
    const html = await page.text()
    const library = await fetch(`${URL}/inkstone-api/library`).then((response) => response.json())
    if (health?.value?.runtime !== 'local-web') throw new Error('Unexpected health response')
    if (!page.ok || !html.includes('web-bridge.js') || !html.includes('Inkleaf')) throw new Error('Web entry point is incomplete')
    if (!library.ok || library.value?.length !== 1 || library.value[0].bookFile !== 'books/sample.epub') throw new Error('Library migration failed')
    await Promise.all([
      access(path.join(libraryDir, 'library.json')),
      access(path.join(libraryDir, 'library.legacy-backup.json')),
      access(path.join(libraryDir, 'books', 'sample.epub')),
      access(path.join(libraryDir, 'notes', '0123456789abcdefabcd', 'notebook.json')),
    ])
    if (await pathExists(path.join(libraryDir, '\u4e66\u7c4d'))) throw new Error('Legacy books directory was not removed')
    if (await pathExists(path.join(libraryDir, '\u7b14\u8bb0'))) throw new Error('Legacy notes directory was not removed')
    if (await pathExists(path.join(libraryDir, '\u58a8\u9875\u4e66\u5e93.json'))) throw new Error('Legacy manifest was not removed')
    console.log('Inkleaf smoke test passed')
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve))
      child.kill()
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))])
    }
    await rm(configDir, { recursive: true, force: true })
  }
  if (stderr.trim()) throw new Error(stderr.trim())
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
