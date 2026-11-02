import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], build: { rollupOptions: { output: { manualChunks: (id: string) => id.includes('node_modules/three/examples') ? 'three-addons' : id.includes('node_modules/three') ? 'three' : id.includes('node_modules/react') ? 'react' : undefined } } }, base: process.env.BASE || '/' });
