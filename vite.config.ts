import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Микрофон в тюнере браузер отдаёт только в защищённом контексте, поэтому для
// проверки с телефона есть отдельный режим: npm run dev:https
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react(), ...(mode === 'https' ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
}))
