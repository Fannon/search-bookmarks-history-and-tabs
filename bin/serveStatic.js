#!/usr/bin/env node

/**
 * Minimal static file server for Playwright tests.
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import process from 'node:process'

const root = resolve(process.argv[2] || 'popup')
const port = Number(process.argv[3] || process.env.PORT || 8080)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

function getFilePath(url = '/') {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname)
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  return resolve(join(root, relativePath))
}

const server = createServer(async (request, response) => {
  try {
    const filePath = getFilePath(request.url)
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403)
      response.end('Forbidden')
      return
    }

    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
      response.writeHead(404)
      response.end('Not found')
      return
    }

    response.writeHead(200, {
      'content-length': fileStat.size,
      'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
    })
    const stream = createReadStream(filePath)
    stream.on('error', () => response.destroy())
    stream.pipe(response)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0)
    })
  })
}
