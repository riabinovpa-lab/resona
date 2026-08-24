import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Микрофон в тюнере браузер отдаёт только в защищённом контексте, поэтому для
// проверки с телефона есть отдельный режим: npm run dev:https
export default defineConfig(({ mode }) => ({
  // На GitHub Pages сайт живёт в подпапке с именем репозитория. Без этого ссылки
  // на файлы сборки указывали бы в корень домена, и страница осталась бы пустой.
  base: mode === 'production' ? '/resona/' : '/',
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
