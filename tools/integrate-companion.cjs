// Mechanical integration points for the prebuilt EPUB reader (source is unavailable).
const fs = require('node:fs')
const path = require('node:path')
const file = path.join(__dirname, '../dist/assets/index-Cni3k_A9.js')
let source = fs.readFileSync(file, 'utf8')
const replacements = [
  ['React.createElement("p",null,b.content)', 'React.createElement(window.InkleafAnswer,{text:b.content,react:Xe})'],
  ['React.createElement(window.InkleafCompanionPanel)', 'React.createElement(window.InkleafCompanionPanel,{react:Xe})'],
  ['r.current=V,await V.ready;', 'r.current=V,await V.ready;window.inkleafAttachBook(V,$);'],
  ['React.createElement("div",{className:"ai-panel"},!ht.hasApiKey', 'React.createElement("div",{className:"ai-panel"},React.createElement(window.InkleafCompanionPanel,{react:Xe}),!ht.hasApiKey'],
]
for (const [before, after] of replacements) {
  if (source.includes(after)) continue
  if (!source.includes(before)) throw new Error('Reader integration point not found.')
  source = source.replace(before, after)
}
fs.writeFileSync(file, source)
