import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // rutas relativas: necesario para que funcione en GitHub Pages (subcarpeta /sistema-comunicacion/)
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']
    }
  }
})
