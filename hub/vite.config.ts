import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5180,
    allowedHosts: true,
    // alt depolardaki binlerce dosyayı izleme (uygulama hub'a bağımlı değil)
    watch: { ignored: ['**/apps/**', '**/node_modules/**', '**/dist/**'] },
  },
  preview: { host: '0.0.0.0', port: 4180, allowedHosts: true },
})
