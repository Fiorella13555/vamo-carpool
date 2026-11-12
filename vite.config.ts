/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: { allowedHosts: ["terminal.local"] },
  plugins: [tailwindcss(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
