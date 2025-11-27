import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ['weatherbird-broadcast-production.up.railway.app', '.railway.app'],
  },
})
