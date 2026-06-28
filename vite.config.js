import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'robots.txt',
          dest: '' 
        },
        {
          src: 'sitemap.xml',
          dest: '' 
        }
      ]
    })
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        form: 'form.html',
        qtt: 'qtt.html',
        rules: 'gdsi_rules.html',
        tnc: 'gdsi_tnc.html',
        qr: 'qr.html',
        admin: 'admin.html'
      }
    }
  }
})