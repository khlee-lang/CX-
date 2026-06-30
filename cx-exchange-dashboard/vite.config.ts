import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 로컬 개발: /api 요청을 로컬 Node 서버로 포워딩
      '/api': 'http://localhost:3001',
    },
  },
})
