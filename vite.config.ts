import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// A static app: everything — reading the attendance, the rules, filling the
// PDF — runs in the browser, so attendance never leaves the person's machine
// and the build deploys anywhere that serves files (Vercel, GitHub Pages).
export default defineConfig({
  plugins: [react()],
  build: {
    // pdf.js (~510 kB) and pdf-lib (~430 kB) are split out and fetched only
    // when a PDF is read or filled, so the first load stays small. The default
    // 500 kB warning would fire on those lazy chunks every build.
    chunkSizeWarningLimit: 600,
  },
})
