import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@rmp/shared-types': resolve(__dirname, '../shared-types/src/index.ts'),
    },
  },
  server: {
    port: 5174
  }
})
