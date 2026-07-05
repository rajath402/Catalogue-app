import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.join(rootDir, 'server')
const deniedBasenames = new Set(['auth.json', 'password-seed.txt', '.env'])

// `server.fs.deny` matches the REQUESTED path, not what it actually
// resolves to on disk — so a symlink placed inside an allowed directory
// (e.g. src/leak.json -> server/data/auth.json) sails straight past it,
// since the request path itself never mentions "server" or "auth.json".
// This plugin closes that gap by resolving symlinks (fs.realpathSync)
// before Vite's own static-file middleware ever sees the request, and
// blocking anything whose REAL target lands in the denied area.
function blockSymlinkEscapes() {
  return {
    name: 'block-symlink-escapes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          const urlPath = decodeURIComponent((req.url || '').split('?')[0])
          const filePath = path.join(rootDir, urlPath)
          if (!fs.existsSync(filePath)) return next()
          const real = fs.realpathSync(filePath)
          const isInServerDir = real === serverDir || real.startsWith(serverDir + path.sep)
          const isDeniedFile = deniedBasenames.has(path.basename(real))
          if (isInServerDir || isDeniedFile) {
            res.statusCode = 403
            res.end('Forbidden')
            return
          }
        } catch {
          // Not a real filesystem path (virtual Vite module, /api/* proxy
          // target, etc.) — let normal handling deal with it.
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [blockSymlinkEscapes(), react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
    // Vite's dev server otherwise serves any file under the project root
    // by direct path request (e.g. GET /server/data/auth.json) — that's
    // how the password hash file was reachable straight from the browser
    // despite Express itself never exposing it. `fs.deny` alone didn't
    // close this off, so the servable boundary itself is narrowed instead:
    // the frontend only ever needs src/public/index.html/node_modules, and
    // the backend (API calls go through the proxy above, never raw file
    // serving) is outside that boundary entirely. The symlink-escape case
    // (see blockSymlinkEscapes above) is handled separately since fs.deny's
    // glob matching alone can't see through a symlink.
    fs: {
      allow: [rootDir],
      deny: ['**/server/**', '**/auth.json', '.env', '.env.*', '*.{crt,pem}', '**/.git/**'],
    },
  },
})
