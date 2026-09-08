import { promises as fs } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Connect, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

function localWorkspacePlugin() {
  const workspacePath = path.resolve(process.cwd(), 'workspace-data.json')

  return {
    name: 'local-workspace-storage',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/workspace', async (request: Connect.IncomingMessage, response) => {
        if (request.method === 'GET') {
          try {
            const content = await fs.readFile(workspacePath, 'utf8')
            response.statusCode = 200
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(content)
          } catch {
            response.statusCode = 404
            response.end()
          }
          return
        }

        if (request.method !== 'PUT') {
          response.statusCode = 405
          response.end()
          return
        }

        const chunks: Buffer[] = []
        let size = 0
        request.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size <= 2 * 1024 * 1024) chunks.push(chunk)
        })
        request.on('end', async () => {
          if (size > 2 * 1024 * 1024) {
            response.statusCode = 413
            response.end()
            return
          }
          try {
            const content = Buffer.concat(chunks).toString('utf8')
            JSON.parse(content)
            const tempPath = `${workspacePath}.tmp`
            await fs.writeFile(tempPath, content, 'utf8')
            try {
              await fs.copyFile(workspacePath, `${workspacePath}.bak`)
            } catch {
              // There may not be an earlier workspace file on first save.
            }
            await fs.rename(tempPath, workspacePath)
            response.statusCode = 204
            response.end()
          } catch {
            response.statusCode = 400
            response.end()
          }
        })
        request.on('error', () => {
          response.statusCode = 400
          response.end()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localWorkspacePlugin()],
})
