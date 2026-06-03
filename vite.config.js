import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        form: 'form.html',
        qtt: 'qtt.html',
        rules: 'gdsi_rules.html',
        tnc: 'gdsi_tnc.html'
      }
    }
  }
})
