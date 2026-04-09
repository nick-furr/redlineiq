import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          // Keep SSE connections alive through the dev proxy
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Connection', 'keep-alive')
          })
          proxy.on('proxyRes', (proxyRes) => {
            // Prevent proxy from buffering SSE streams
            proxyRes.headers['x-accel-buffering'] = 'no'
          })
        },
      },
    },
  },
})
