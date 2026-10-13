import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const errors = []
let files = 0
const assets = new Set()
const fail = (file, message) => errors.push(`${file}: ${message}`)
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { scan(file); continue }
    if (!/\.(tsx?|css|html|json)$/.test(file)) continue
    files++
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\/assets\/[\w./-]+\.(?:png|jpe?g|svg|webp|gif|woff2|ttf)/g)) {
      assets.add(match[0])
      if (!fs.existsSync(path.join('public', match[0]))) fail(file, `recurso ausente ${match[0]}`)
    }
    if (/\.tsx?$/.test(file)) {
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
      function visit(node) {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'framer') fail(file, 'dependencia del editor Framer')
        if (ts.isIdentifier(node) && ['RenderTarget', 'ControlType', 'addPropertyControls'].includes(node.text)) fail(file, `API de Framer ${node.text}`)
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /https:\/\/(?:framerusercontent|framer)\.com/.test(node.text)) fail(file, 'recurso externo de Framer')
        ts.forEachChild(node, visit)
      }
      visit(ast)
    } else if (/\.(css|html)$/.test(file) && /https:\/\/(?:framerusercontent|framer)\.com/.test(source)) fail(file, 'recurso externo de Framer')
    if (file.endsWith('framer-props.json') && /"expression"\s*:/.test(source)) fail(file, 'prop sin resolver durante la migración')
  }
}
scan('src')
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else console.log(`Migración comprobada: ${files} archivos, ${assets.size} recursos locales, sin dependencia del editor ni hosting de Framer.`)
