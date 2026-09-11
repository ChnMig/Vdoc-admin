import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(`${root}dist/.vite/manifest.json`, 'utf8'))
const { limits } = JSON.parse(readFileSync(`${root}performance-budget.json`, 'utf8'))
const entry = Object.keys(manifest).find((key) => manifest[key].isEntry)
assert(entry, 'Build manifest must include an entry')
const staticImports = (key, seen = new Set()) => {
  if (seen.has(key)) return seen
  seen.add(key)
  for (const dependency of manifest[key].imports ?? []) staticImports(dependency, seen)
  return seen
}
const measure = (keys) => {
  let bytes = 0
  let gzipBytes = 0
  for (const key of keys) {
    const body = readFileSync(`${root}dist/${manifest[key].file}`)
    bytes += body.length
    gzipBytes += gzipSync(body).length
  }
  return { bytes, gzipBytes }
}
const entryImports = staticImports(entry)
const layoutKey = 'src/routes/_authenticated/route.tsx?tsr-split=component'
assert(manifest[layoutKey], 'Authenticated layout must remain lazy')
const layoutImports = staticImports(layoutKey)
const entrySize = measure(entryImports)
assert(entrySize.gzipBytes <= limits.entryGzipBytes, 'Entry exceeds gzip budget')
const pages = Object.keys(manifest).filter((key) => /^src\/routes\/_authenticated\/(?:(?:audit|diffs|documents|drafts|mcp-tokens|projects|settings|skill|teams|users|versions)\/)?index\.tsx\?tsr-split=component$/.test(key))
assert(pages.length >= limits.minimumPageChunks, 'Workbench pages must load independently')
assert(!Object.values(manifest).some((chunk) => /\/pages-/.test(chunk.file)), 'Monolithic pages bundle returned')
const report = { entry: entrySize, pages: {} }
for (const key of pages) {
  assert(!entryImports.has(key), `${key} is eagerly imported by the entry`)
  const chunk = measure([key])
  const dependencies = staticImports(key)
  assert(![...dependencies].some((dependency) => manifest[dependency].file.includes('/markdown-document-viewer-')), `${key} eagerly loads Markdown rendering`)
  const route = measure(new Set([...entryImports, ...layoutImports, ...dependencies]))
  assert(chunk.bytes <= limits.pageChunkBytes, `${key} exceeds page chunk budget`)
  assert(route.gzipBytes <= limits.routeGzipBytes, `${key} exceeds route gzip budget`)
  report.pages[manifest[key].name ?? key] = { chunk, route }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\nBuild budget passed\n`)
