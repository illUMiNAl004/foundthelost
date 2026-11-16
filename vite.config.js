import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only bridge: serve the Netlify Function at /api/vision from the Vite dev server so
// Snap & Fill works under `npm run dev` without the Netlify CLI. Secrets (OPENROUTER_API_KEY /
// GEMINI_API_KEY) are read from .env.local here, server-side — they never enter the bundle.
function devApi(env) {
  return {
    name: 'ftl-dev-api',
    configureServer(server) {
      // hype phase: the landing page is locked behind the waitlist cover (mirrors scripts/lock-landing.mjs)
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/landing.html' && (env.VITE_WAITLIST || 'off').toLowerCase() === 'on') {
          res.statusCode = 302; res.setHeader('Location', '/'); return res.end()
        }
        next()
      })
      server.middlewares.use('/api/vision', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/netlify/functions/vision.mjs')
          const chunks = []
          for await (const c of req) chunks.push(c)
          const body = Buffer.concat(chunks)
          const url = `http://${req.headers.host}${req.originalUrl || req.url}`
          const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
          })
          // 45s: room for the open-weights Gemma 31B (~30s/photo) when it's the chosen model
          const response = await mod.handleVision(request, { VISION_BUDGET_MS: '45000', ...process.env, ...env })
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          console.error('[dev api]', e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // '' prefix → include non-VITE_ secrets (server-side only)
  return {
    plugins: [react(), devApi(env)],
    server: { port: 5173 },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: { maplibre: ['maplibre-gl'], vendor: ['react', 'react-dom', 'framer-motion', '@supabase/supabase-js'] },
        },
      },
    },
  }
})
