import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- 1. ADICIONAR ESTA LINHA AQUI

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3'] // Aquela nossa correção da BD
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    // 2. ADICIONAR O tailwindcss() AQUI NOS PLUGINS DO RENDERER
    plugins: [react(), tailwindcss()]
  }
})
