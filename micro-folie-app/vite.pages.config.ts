import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: here('./pages'),
  base: '/micro-folie-noisy-le-sec/',
  publicDir: here('./public'),
  resolve: { alias: { '@': here('./') } },
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: here('../docs'), emptyOutDir: true, rollupOptions: { input: here('./pages/app.html') } },
});
