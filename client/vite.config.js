import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Indispensable pour héberger l'application dans portfolio.antonyrodrigues.fr/Pronostics-Competition/
  base: '/Pronostics-Competition/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});