
// https://vite.dev/config/
import { defineConfig } from 'vite'
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   
    port: 5173,
    allowedHosts: [
      "peplead.in",
      "www.peplead.in"
    ]
  }


})
