import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // .envはモノレポルート(api/と共有)に1つだけ置く運用にしている。
  envDir: path.resolve(import.meta.dirname, '..'),
  server: {
    // 開発時もAPIを同一オリジン相当(/api)で叩けるようにプロキシする。
    // 本番のExpress同一オリジン配信と挙動を揃え、CORS設定への依存を無くすため。
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
