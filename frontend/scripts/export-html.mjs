import { readFile, writeFile, appendFile, rename, rm, stat } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import data from '../public/media/memories.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const publicRoot = resolve(root, 'public')
const output = resolve(root, '../our-love-story.html')
const temporary = `${output}.tmp`
const cursorSettings = JSON.parse(await readFile(resolve(publicRoot, 'cursors/cursor-settings.json'), 'utf8'))
const mimeTypes = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.ogg': 'video/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.otf': 'font/otf', '.ttf': 'font/ttf',
}
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c')
const assetData = async (path) => {
  const decoded = decodeURIComponent(path.replace(/^\/+/, ''))
  const bytes = await readFile(resolve(publicRoot, decoded))
  return `data:${mimeTypes[extname(decoded).toLowerCase()] || 'application/octet-stream'};base64,${bytes.toString('base64')}`
}

try {
  const result = await build({
    configFile: false,
    root,
    base: '/',
    logLevel: 'warn',
    define: { 'process.env.NODE_ENV': '"production"' },
    esbuild: { jsx: 'automatic' },
    build: {
      write: false,
      copyPublicDir: false,
      cssCodeSplit: false,
      rollupOptions: {
        input: resolve(root, 'src/main.jsx'),
        output: { format: 'iife', inlineDynamicImports: true },
      },
    },
  })
  const script = result.output.find((file) => file.type === 'chunk').code
  let css = result.output.filter((file) => file.fileName.endsWith('.css')).map((file) => file.source).join('\n')
  const references = [...css.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/g)]
  for (const [match, , path] of references) {
    if (/^(data:|#)/.test(path)) continue
    css = css.replaceAll(match, `url("${await assetData(path)}")`)
  }
  const title = data.config.title.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
  await writeFile(temporary, `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E"><title>${title}</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><script>window.__OFFLINE_STORY__=${json({ data, cursorSettings, assets: {} })};</script>`)
  const paths = new Set([
    ...data.memories.map((memory) => `media/${memory.image}`),
    ...cursorSettings.themes.flatMap((theme) => [theme.default?.image, theme.hover?.image]).filter(Boolean),
  ].map((path) => path.replace(/^\/+/, '')))
  // Write one asset at a time, keeping generation memory usage independent of album size.
  for (const path of paths) {
    await appendFile(temporary, `<script>window.__OFFLINE_STORY__.assets[${json(path)}]=${json(await assetData(path))};document.currentScript.remove();</script>`)
  }
  await appendFile(temporary, `<script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
  await rename(temporary, output)
  console.log(`Created ${output}\n${data.memories.length} memories, all media, fonts, styling, and interactions embedded (${((await stat(output)).size / 1024 / 1024).toFixed(1)} MB).`)
} catch (error) {
  await rm(temporary, { force: true })
  throw error
}
