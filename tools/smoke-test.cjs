const { spawn } = require('node:child_process')
const { mkdtemp, rm } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PORT = 43281
const URL = `http://127.0.0.1:${PORT}`

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
    if (!library.ok || !Array.isArray(library.value)) throw new Error('Library endpoint is unavailable')
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
