import { defineConfig } from 'vite'

// robots.txt dan sitemap.xml ada di folder public/
// Vite otomatis copy semua isi public/ ke dist/ saat build
// Tidak perlu plugin tambahan — lebih ringan dan tidak ada dependency baru

export default defineConfig({
  publicDir: 'public',
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
})
