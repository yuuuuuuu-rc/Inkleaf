const fs = require('node:fs')
const path = require('node:path')
const filename = path.join(__dirname, '../dist/assets/index-Cni3k_A9.js')
let source = fs.readFileSync(filename, 'utf8')
const replacements = [
  ['V=Jn(gg(b.data))', 'V=/\\.pdf$/i.test(b.name)?window.inkleafCreatePdf(gg(b.data),b.name):Jn(gg(b.data))'],
  ['if(!/\\.epub$/i.test(b.name)){U("Drop an .epub file here")', 'if(!/\\.(epub|pdf)$/i.test(b.name)){U("Drop an .epub or .pdf file here")'],
  ['autoTranslate:!0},Oi=', 'autoTranslate:!1},Oi='],
  ['return JSON.parse(localStorage.getItem(`${Pd}preferences`))||{}', 'const saved=JSON.parse(localStorage.getItem(`${Pd}preferences`))||{};return saved.translationPreferenceVersion===1?saved:{...saved,autoTranslate:!1,translationPreferenceVersion:1}'],
  ['const c={...Ue,...b};ut(c);', 'const c={...Ue,...b};s.current.prefs=c;ut(c);'],
  ['React.createElement("div",{className:"topbar-actions"},', 'React.createElement("div",{className:"topbar-actions"},React.createElement("button",{className:"translation-toggle","aria-pressed":Ue.autoTranslate,onClick:()=>yt({autoTranslate:!Ue.autoTranslate}),title:"Only translate selected text automatically when enabled"},Ue.autoTranslate?"Auto-translate: On":"Auto-translate: Off"),'],
  ['s.current.prefs.autoTranslate&&Zt(Ze)', 's.current.prefs.autoTranslate&&(W("translate"),Zt(Ze))'],
]
for (const [before, after] of replacements) {
  if (source.includes(after)) continue
  if (!source.includes(before)) throw new Error(`Integration point not found: ${before}`)
  source = source.replace(before, after)
}
source = source.replace(/Import EPUB(?! \/ PDF)/g, 'Import EPUB / PDF').replace(/Choose EPUB(?! \/ PDF)/g, 'Choose EPUB / PDF')
  .replaceAll('Import an EPUB into your local library', 'Import an EPUB or PDF into your local library')
  .replaceAll('Every EPUB has independent', 'Every book has independent')
  .replaceAll('stores EPUBs, book-specific notes', 'stores EPUBs, PDFs, book-specific notes')
fs.writeFileSync(filename, source)
