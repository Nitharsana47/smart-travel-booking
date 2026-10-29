import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin API calls in development, so the refresh cookie just works.
    proxy: { '/api': 'http://127.0.0.1:4000' },
    // Allow importing ../shared (pricing, seats and rules shared with the backend).
    fs: { allow: ['..'] },
  },
})
