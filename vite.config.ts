import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/payment-schedule-simulator/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});