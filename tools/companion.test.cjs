const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createCompanion, searchGemini, parseObject } = require('../companion.cjs')

test('structured responses tolerate explanatory wrappers and quoted braces', () => {
  assert.deepEqual(parseObject('```json\n{"sectionIds":[0],"searchQuery":"a {quote}"}\n```\nExplanation'), { sectionIds: [0], searchQuery: 'a {quote}' })
  assert.throws(() => parseObject('{"notes":"incomplete'), /incomplete/)
})

async function fixture(t, requestModel, searchWeb = async () => ({ text: '', sources: [] })) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkleaf-companion-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const companion = createCompanion({ directoryFor: async () => dir, requestModel, searchWeb, settings: async () => ({ targetLanguage: 'Chinese' }) })
  return { companion, dir }
}
async function settled(companion) {
  for (let i = 0; i < 200; i++) {
    const state = await companion.status('book')
    if (state.status !== 'reading') return state
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('Job did not complete')
}

test('full text coverage, private status, evidence retrieval and revised memory survive reload', async t => {
  const reads = []
  let answerRequest
  let searched = ''
  const fake = async ({ messages }) => {
    const instruction = messages[0].content
    if (instruction.includes('Read this entire section')) { reads.push(JSON.parse(messages[1].content).text); return 'A factual summary, section 0.' }
    if (instruction.includes('Update a cumulative')) return 'PRIVATE_MAP: thesis and reading plan, section 0'
    if (instruction.includes('Select up to')) return JSON.stringify({ sectionIds: [0], searchQuery: 'public factual query' })
    if (instruction.includes('Update your private')) return JSON.stringify({ notes: 'Revised understanding; reader hypothesis remains unverified.', reason: 'Clarified terminology' })
    answerRequest = messages
    return 'A grounded explanation.'
  }
  const { companion, dir } = await fixture(t, fake, async query => { searched = query; return { text: 'A verified fact.', sources: [{ title: 'Primary source', url: 'https://example.org/source' }] } })
  const text = 'a'.repeat(19000) + 'THE END'
  await companion.start('book', [{ title: 'First chapter', text }, { title: 'Second chapter', text: 'Last section' }])
  const status = await settled(companion)
  assert.equal(status.status, 'ready')
  assert.equal(status.completed, 3)
  assert.equal(reads.join(''), text + 'Last section')
  assert.ok(!JSON.stringify(status).includes('PRIVATE_MAP'))
  const answer = await companion.chat({ bookId: 'book', messages: [{ role: 'user', content: 'Explain and verify this idea' }] })
  assert.equal(searched, 'public factual query')
  assert.match(answer, /https:\/\/example.org\/source/)
  assert.match(answerRequest[1].content, /First chapter/)
  const memory = JSON.parse(await fs.readFile(path.join(dir, 'memory.json')))
  assert.match(memory.overview, /Revised understanding/)
  assert.equal(memory.revisions.length, 1)
  assert.match(memory.revisions[0].previous, /PRIVATE_MAP/)
  const reloaded = createCompanion({ directoryFor: async () => dir, requestModel: fake, settings: async () => ({}) })
  assert.equal((await reloaded.status('book')).revisionCount, 1)
  const previous = reads.length
  await companion.start('book', [{ title: 'First chapter', text }, { title: 'Second chapter', text: 'Last section' }])
  assert.equal(reads.length, previous)
})

test('failed pre-reading resumes at last checkpoint and refuses premature chat', async t => {
  let fail = true
  const sections = []
  const { companion } = await fixture(t, async ({ messages }) => {
    if (messages[0].content.includes('Read this entire section')) {
      const chunk = JSON.parse(messages[1].content)
      sections.push(chunk.id)
      if (chunk.id === 1 && fail) throw new Error('Provider unavailable')
    }
    return 'Summary'
  })
  await assert.rejects(companion.chat({ bookId: 'book' }), /pre-reading/)
  const chapters = [{ text: 'a'.repeat(19000) }]
  await companion.start('book', chapters)
  const failed = await settled(companion)
  assert.equal(failed.status, 'error')
  assert.equal(failed.completed, 1)
  fail = false
  await companion.start('book', chapters)
  assert.equal((await settled(companion)).status, 'ready')
  assert.deepEqual(sections, [0, 1, 1])
})

test('disabled web search makes no network calls; malformed updates preserve old notes', async t => {
  let searches = 0
  const { companion, dir } = await fixture(t, async ({ messages }) => {
    const instruction = messages[0].content
    if (instruction.includes('Select up to')) return '{"sectionIds":[0],"searchQuery":"query"}'
    if (instruction.includes('Update your private')) return 'invalid JSON'
    if (instruction.includes('You have pre-read')) return 'An explanation: https://invented.invalid/source'
    return 'Original notes'
  }, async () => { searches++; throw new Error('Should not search') })
  await companion.start('book', [{ text: 'Content' }]); await settled(companion)
  const answer = await companion.chat({ bookId: 'book', messages: [{ role: 'user', content: 'question' }], webSearch: false })
  assert.equal(searches, 0)
  assert.match(answer, /could not be updated/)
  assert.ok(!answer.includes('https://invented.invalid'))
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'memory.json'))).overview, 'Original notes')
})

test('Gemini search uses grounding metadata, filters thought text and rejects unverified results', async () => {
  const config = { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', apiKey: 'fake', model: 'gemini-test' }
  const result = await searchGemini('question', config, async (url, options) => {
    assert.match(url, /models\/gemini-test:generateContent$/)
    assert.deepEqual(JSON.parse(options.body).tools, [{ google_search: {} }])
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Internal', thought: true }, { text: 'Verified' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.org', title: 'Evidence' } }] } }] }) }
  })
  assert.equal(result.text, 'Verified')
  assert.equal(result.sources[0].url, 'https://example.org')
  await assert.rejects(searchGemini('question', config, async () => ({ ok: true, json: async () => ({ candidates: [] }) })), /no verifiable/)
  await assert.rejects(searchGemini('question', { baseUrl: 'https://other.example', apiKey: 'fake' }), /direct Gemini/)
})

test('pause checkpoints the active section and allows a later resume', async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const { companion } = await fixture(t, async () => { await gate; return 'Summary' })
  await companion.start('book', [{ text: 'a'.repeat(19000) }])
  await companion.pause('book')
  release()
  const paused = await settled(companion)
  assert.equal(paused.status, 'paused')
  assert.equal(paused.completed, 1)
  await companion.start('book', [{ text: 'a'.repeat(19000) }])
  assert.equal((await settled(companion)).completed, 2)
})
