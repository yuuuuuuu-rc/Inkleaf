(function () {
  const VENDOR = '/vendor/pdfjs/'
  const pageNumber = anchor => Math.max(1, Number(String(anchor || '').match(/^(?:pdf:|pdf-page-)(\d+)/)?.[1] || 1))
  function boxes(anchor) {
    try { return JSON.parse(decodeURIComponent(String(anchor).split(':')[2] || '[]')) } catch { return [] }
  }

  window.inkleafCreatePdf = function (data, filename) {
    let pdf, lib, view, destroyed = false, loadingTask
    const book = {
      spine: { spineItems: [] },
      load: async () => {},
      locations: {
        generate: async () => {},
        percentageFromCfi: anchor => pdf.numPages < 2 ? 0 : (pageNumber(anchor) - 1) / (pdf.numPages - 1),
      },
      destroy() { destroyed = true; view?.destroy(); loadingTask?.destroy().catch(() => {}) },
      renderTo(container) { view = createView(container); return view },
    }
    book.ready = (async () => {
      lib = await import(`${VENDOR}pdf.mjs`)
      lib.GlobalWorkerOptions.workerSrc = `${VENDOR}pdf.worker.mjs`
      if (destroyed) throw new Error('PDF loading was cancelled.')
      loadingTask = lib.getDocument({ data: new Uint8Array(data), cMapUrl: `${VENDOR}cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${VENDOR}standard_fonts/`, wasmUrl: `${VENDOR}wasm/`, iccUrl: `${VENDOR}iccs/`,
        isEvalSupported: false, enableXfa: false })
      pdf = await loadingTask.promise
      book.spine.spineItems = Array.from({ length: pdf.numPages }, (_, index) => ({
        href: `pdf-page-${index + 1}/`,
        async load() {
          const page = await pdf.getPage(index + 1)
          const content = await page.getTextContent()
          const section = document.createElement('div')
          section.textContent = content.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('')
          return section
        },
      }))
    })()
    book.loaded = {
      metadata: book.ready.then(async () => { const meta = await pdf.getMetadata().catch(() => null); return { title: meta?.info?.Title || filename.replace(/\.pdf$/i, ''), creator: meta?.info?.Author || '' } }),
      navigation: book.ready.then(() => ({ toc: Array.from({ length: pdf.numPages }, (_, i) => ({ label: `Page ${i + 1}`, href: `pdf-page-${i + 1}/` })) })),
    }
    // The caller awaits ready before the derived promises; mark early rejections handled.
    book.loaded.metadata.catch(() => {}); book.loaded.navigation.catch(() => {})

    function createView(container) {
      const listeners = new Map(), highlights = new Map()
      let current = 1, zoom = 1, alive = true, serial = Promise.resolve(), theme = 'paper', rendered = false
      const shell = document.createElement('div'); shell.className = 'pdf-reader'
      const toolbar = document.createElement('div'); toolbar.className = 'pdf-toolbar'
      const previous = document.createElement('button'); previous.textContent = 'Previous page'
      const next = document.createElement('button'); next.textContent = 'Next page'
      const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = String(pdf.numPages); input.setAttribute('aria-label', 'PDF page number')
      const count = document.createElement('span'); count.textContent = ` / ${pdf.numPages}`
      const status = document.createElement('span'); status.className = 'pdf-status'; status.setAttribute('role', 'status')
      toolbar.append(previous, input, count, next, status)
      const scroller = document.createElement('div'); scroller.className = 'pdf-scroll'
      const surface = document.createElement('div'); surface.className = 'pdf-page'
      scroller.append(surface); shell.append(toolbar, scroller); container.replaceChildren(shell)
      const emit = (name, ...args) => listeners.get(name)?.(...args)
      const location = () => ({ start: { cfi: `pdf:${current}`, href: `pdf-page-${current}/`, percentage: book.locations.percentageFromCfi(`pdf:${current}`) } })

      function drawHighlights() {
        surface.querySelectorAll('.pdf-highlight').forEach(element => element.remove())
        for (const [anchor, mark] of highlights) {
          if (pageNumber(anchor) !== current) continue
          for (const rect of boxes(anchor)) {
            if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) continue
            const element = document.createElement('div'); element.className = 'pdf-highlight'
            Object.assign(element.style, { left: `${rect[0] * 100}%`, top: `${rect[1] * 100}%`, width: `${rect[2] * 100}%`, height: `${rect[3] * 100}%`, background: mark.color })
            surface.append(element)
          }
        }
      }
      async function render(anchor) {
        if (!alive) return
        const requested = Math.min(pdf.numPages, pageNumber(anchor))
        const page = await pdf.getPage(requested)
        if (!alive) return
        const base = page.getViewport({ scale: 1 })
        const scale = Math.max(0.15, (scroller.clientWidth - 32) / base.width) * zoom
        const viewport = page.getViewport({ scale })
        const density = Math.min(window.devicePixelRatio || 1, 2, 12000 / Math.max(viewport.width, viewport.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width * density); canvas.height = Math.ceil(viewport.height * density)
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`
        surface.style.width = `${viewport.width}px`; surface.style.height = `${viewport.height}px`
        surface.style.setProperty('--total-scale-factor', String(scale * (page.userUnit || 1)))
        surface.replaceChildren(canvas)
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [density, 0, 0, density, 0, 0] }).promise
        if (!alive) return
        const content = await page.getTextContent()
        const layer = document.createElement('div'); layer.className = 'textLayer'
        surface.append(layer)
        await new lib.TextLayer({ textContentSource: content, container: layer, viewport }).render()
        current = requested; rendered = true; input.value = String(current)
        previous.disabled = current <= 1; next.disabled = current >= pdf.numPages
        status.textContent = content.items.some(item => item.str?.trim()) ? 'Drag to select text' : 'No selectable text on this page (OCR is not included)'
        drawHighlights(); scroller.scrollTop = 0
        const first = boxes(anchor)[0]
        if (first) scroller.scrollTop = Math.max(0, first[1] * viewport.height - 80)
        emit('relocated', location())
      }
      const display = anchor => {
        serial = serial.catch(() => {}).then(() => render(anchor || `pdf:${current}`))
        return serial
      }
      const navigate = anchor => display(anchor).catch(error => { if (alive) status.textContent = error.message })
      previous.onclick = () => navigate(`pdf:${current - 1}`)
      next.onclick = () => navigate(`pdf:${current + 1}`)
      input.onchange = () => navigate(`pdf:${Math.max(1, Math.min(pdf.numPages, Number(input.value) || 1))}`)
      surface.onpointerup = () => {
        const selection = window.getSelection()
        if (!selection?.rangeCount || !selection.toString().trim()) return
        const range = selection.getRangeAt(0)
        const layer = surface.querySelector('.textLayer')
        if (!layer?.contains(range.startContainer) || !layer.contains(range.endContainer)) return
        const pageRect = surface.getBoundingClientRect()
        const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0).slice(0, 500)
          .map(rect => [(rect.left - pageRect.left) / pageRect.width, (rect.top - pageRect.top) / pageRect.height, rect.width / pageRect.width, rect.height / pageRect.height])
        emit('selected', `pdf:${current}:${encodeURIComponent(JSON.stringify(rects))}`, { window })
      }
      surface.onclick = event => {
        if (window.getSelection()?.toString()) return
        const pageRect = surface.getBoundingClientRect(), x = (event.clientX - pageRect.left) / pageRect.width, y = (event.clientY - pageRect.top) / pageRect.height
        for (const [anchor, mark] of highlights) {
          if (pageNumber(anchor) === current && boxes(anchor).some(r => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3])) { mark.callback?.(); break }
        }
      }
      let resizeTimer, width = container.clientWidth
      const observer = new ResizeObserver(() => {
        if (Math.abs(width - container.clientWidth) < 2) return
        width = container.clientWidth; clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => { if (alive && rendered) navigate(`pdf:${current}`) }, 150)
      })
      observer.observe(container)
      return {
        on: (event, callback) => listeners.set(event, callback), display,
        prev: () => navigate(`pdf:${current - 1}`), next: () => navigate(`pdf:${current + 1}`),
        currentLocation: location, flow: () => {},
        themes: { register() {}, select(value) { theme = value; shell.dataset.theme = theme }, fontSize(value) { zoom = Number.parseFloat(value) / 100 || 1; if (rendered) navigate(`pdf:${current}`) } },
        annotations: {
          highlight(anchor, data, callback, className, styles) { highlights.set(anchor, { data, callback, color: styles?.fill || '#F6D979' }); drawHighlights() },
          remove(anchor) { highlights.delete(anchor); drawHighlights() },
        },
        destroy() { alive = false; observer.disconnect(); clearTimeout(resizeTimer); listeners.clear(); shell.remove() },
      }
    }
    return book
  }
})()
