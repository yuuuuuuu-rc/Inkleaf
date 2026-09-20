// Isolated manual browser test: node tools/pdf-ui-server.cjs <sample.pdf>
// Uses a temporary library and a fake AI endpoint; no real library or API key is used.
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn } = require('node:child_process')

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'inkleaf-pdf-ui-'))
  let calls = 0
  const mock = http.createServer(async (request, response) => {
    for await (const _ of request) { /* Drain request body. */ }
    response.setHeader('Content-Type', 'application/json')
    if (request.method === 'GET') return response.end(JSON.stringify({ calls }))
    calls++
    response.end(JSON.stringify({ choices: [{ message: { content: 'Test translation: selected text translated.' } }] }))
  })
  await new Promise(resolve => mock.listen(43631, '127.0.0.1', resolve))
  await fs.writeFile(path.join(directory, 'settings.json'), JSON.stringify({ libraryPath: path.join(directory, 'library'), apiKey: 'test-only', baseUrl: 'http://127.0.0.1:43631/v1', model: 'test', targetLanguage: 'English' }))
  const child = spawn(process.execPath, [path.join(__dirname, '../server.cjs')], { env: { ...process.env, INKLEAF_CONFIG_DIR: directory, INKLEAF_PORT: '43630' }, stdio: 'inherit', windowsHide: true })
  async function cleanup() { child.kill(); mock.close(); process.exit() }
  process.once('SIGINT', cleanup); process.once('SIGTERM', cleanup)
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch('http://127.0.0.1:43630/inkstone-api/health')).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const data = await fs.readFile(process.argv[2])
  const response = await fetch('http://127.0.0.1:43630/inkstone-api/library/import-bytes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Inkstone-Web': '1' }, body: JSON.stringify({ name: 'PDF selection test.pdf', dataBase64: data.toString('base64') }) })
  const result = await response.json()
  if (!result.ok) throw new Error(result.error)
  console.log(JSON.stringify({ url: 'http://127.0.0.1:43630', library: directory, id: result.value.id }))
}
main().catch(error => { console.error(error); process.exit(1) })
