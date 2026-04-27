import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https';
import crypto from 'crypto'; // 需引入 crypto

export default defineConfig({
  plugins: [react()],
  server: {
    historyApiFallback: true,   // dev: 所有路由回傳 index.html
  },
  preview: {
    historyApiFallback: true,   // preview 模式
  },
})