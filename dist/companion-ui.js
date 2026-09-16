(function () {
  let currentBook = null
  const listeners = new Set()
  const api = window.inkstone
  let searchEnabled = true

  async function request(id, chapters, action) {
    const response = await fetch(`/inkstone-api/companion/${encodeURIComponent(id)}`, {
      method: chapters || action ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Inkstone-Web': '1' },
      ...(chapters || action ? { body: JSON.stringify({ chapters, action }) } : {}),
    })
    const result = await response.json()
    if (!response.ok || !result.ok) throw new Error(result.error || 'Pre-reading failed.')
    return result.value
  }

  window.inkleafAttachBook = (book, id) => {
    currentBook = { book, id }
    for (const notify of listeners) notify()
  }

  const originalChat = api.askReaderAI
  api.askReaderAI = payload => {
    if (!currentBook) throw new Error('Open a book first.')
    return originalChat({ ...payload, bookId: currentBook.id, webSearch: searchEnabled })
  }

  window.InkleafAnswer = function ({ text, react: React }) {
    return React.createElement('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
      String(text).split(/(https?:\/\/[^\s<>\])]+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? React.createElement('a', { key: index, href: part, target: '_blank', rel: 'noopener noreferrer' }, part) : part))
  }

  window.InkleafCompanionPanel = function ({ react: React }) {
    const [active, setActive] = React.useState(currentBook)
    const [status, setStatus] = React.useState(null)
    const [error, setError] = React.useState('')
    const [extracting, setExtracting] = React.useState(false)
    const [web, setWeb] = React.useState(searchEnabled)
    React.useEffect(() => {
      const changed = () => { setActive(currentBook); setStatus(null); setError('') }
      listeners.add(changed)
      return () => listeners.delete(changed)
    }, [])
    React.useEffect(() => {
      if (!active) return
      let alive = true
      const poll = async () => {
        try { const next = await request(active.id); if (alive) setStatus(next) }
        catch (failure) { if (alive) setError(failure.message) }
      }
      poll()
      const timer = setInterval(poll, 2500)
      return () => { alive = false; clearInterval(timer) }
    }, [active])
    async function start() {
      if (!active) return
      setExtracting(true); setError('')
      try {
        const chapters = []
        for (const section of active.book.spine.spineItems) {
          const element = await section.load(active.book.load.bind(active.book))
          // Clone before removing non-content nodes; do not modify the reading view.
          const clone = element.cloneNode(true)
          clone.querySelectorAll('script,style,head').forEach(node => node.remove())
          clone.querySelectorAll('p,div,h1,h2,h3,h4,li,br').forEach(node => node.appendChild(node.ownerDocument.createTextNode('\n')))
          const text = (clone.textContent || '').replace(/[\t ]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim()
          if (text) chapters.push({ title: clone.querySelector('h1,h2,h3')?.textContent.trim() || section.href, text })
        }
        const next = await request(active.id, chapters)
        if (currentBook === active) setStatus(next)
      } catch (failure) { if (currentBook === active) setError(failure.message) }
      finally { setExtracting(false) }
    }
    const running = extracting || status?.status === 'reading'
    const label = extracting ? 'Extracting book text...' : status?.status === 'ready' ? 'Whole-book preparation complete' : status?.status === 'reading' ? `Pre-reading: ${status.completed} / ${status.total} sections` : status?.status === 'paused' ? 'Pre-reading paused; resume below' : 'Prepare the whole book before chatting'
    return React.createElement('section', { className: 'setup-card', style: { display: 'block', padding: '14px', marginBottom: '12px' } },
      React.createElement('strong', null, label),
      React.createElement('p', { style: { fontSize: '12px', lineHeight: 1.5 } }, 'AI reads all extractable text and keeps private study notes that evolve during your conversation. Pre-reading sends book text to your API provider and may incur charges.'),
      status?.status !== 'ready' && React.createElement('button', { type: 'button', className: 'primary-button small', disabled: running || !active, onClick: start }, running ? 'Preparing...' : status?.completed ? 'Resume pre-reading' : 'Pre-read whole book'),
      status?.status === 'reading' && React.createElement('button', { type: 'button', className: 'ghost-button', onClick: async () => { try { await request(active.id, null, 'pause'); setError('Pausing after the current section...') } catch (failure) { setError(failure.message) } } }, 'Pause'),
      React.createElement('label', { style: { display: 'block', marginTop: '10px', fontSize: '13px' } }, React.createElement('input', { type: 'checkbox', checked: web, onChange: event => { searchEnabled = event.target.checked; setWeb(searchEnabled) } }), ' Allow web search when needed (Gemini; extra charges may apply)'),
      (error || status?.error) && React.createElement('p', { role: 'alert', style: { color: '#a5362d' } }, error || status.error))
  }
})()
