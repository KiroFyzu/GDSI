import { defineConfig, loadEnv } from 'vite'
import donationHandler from './api/donation.js'

// robots.txt dan sitemap.xml ada di folder public/
// Vite otomatis copy semua isi public/ ke dist/ saat build
// Tidak perlu plugin tambahan — lebih ringan dan tidak ada dependency baru

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw)
}

function attachJsonResponse(res) {
  res.status = function status(code) {
    res.statusCode = code
    return {
      json(data) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
  publicDir: 'public',
  plugins: [
    {
      name: 'gdsi-local-api',
      configureServer(server) {
        server.middlewares.use('/api/donation', async (req, res) => {
          try {
            const url = new URL(req.url || '/', 'http://localhost')
            req.query = Object.fromEntries(url.searchParams.entries())
            req.body = req.method === 'POST' ? await readJsonBody(req) : {}
            attachJsonResponse(res)
            await donationHandler(req, res)
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: false,
              error: err.message || 'Local donation API error'
            }))
          }
        })
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main    : 'index.html',
        form    : 'form.html',
        qtt     : 'qtt.html',
        rules   : 'gdsi_rules.html',
        tnc     : 'gdsi_tnc.html',
        qr      : 'qr.html',
        admin   : 'admin.html',
        donation: 'donation.html'
      }
    }
  }
  }
})
