import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ })],
  // Next.js allows JSX inside .js files (page.js, layout.js); teach Vite/esbuild the same.
  esbuild: { loader: 'jsx', include: /(src|tests)\/.*\.jsx?$/, exclude: [] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
  },
});
