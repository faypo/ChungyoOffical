import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https';
import crypto from 'crypto'; // 需引入 crypto

export default defineConfig({
  plugins: [react()],
  server: {
    historyApiFallback: true,   // dev: 所有路由回傳 index.html
    proxy: {
      '/feedback': {
        target: 'https://emp-test.chungyo.com.tw',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/feedback/, ''),
        agent: new https.Agent({
          secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        }),
        // 加入這段 configure 來印出實際的 URL
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('原始路徑:', req.url);
            console.log('實際發送 URL:', options.target + proxyReq.path);
          });
        },
      },
    },
  },
  preview: {
    historyApiFallback: true,   // preview 模式
  },
})