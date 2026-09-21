import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    // Tashqi tunnel (quick tunnel / dev.oazisedu.uz) orqali kirishga ruxsat —
    // aks holda Vite "Blocked request. This host is not allowed" beradi.
    // Admin (/admin) va teacher (/teacher) panellari — ikkalasi ham shu serverda.
    allowedHosts: ['.trycloudflare.com', '.oazisedu.uz'],
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        fileURLToPath(new URL('../shared', import.meta.url)),
      ],
    },
  },
})
