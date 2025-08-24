/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  base: '/DollarZing/',
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name ? assetInfo.name.split('.') : [];
          let extType = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img';
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,ts,tsx}'],
    exclude: [
      'node_modules', 
      'dist', 
      '.git', 
      '*.config.*',
      '**/*.d.ts',
      '**/*.d.ts.map',
      '**/*.js.map'
    ],
    root: '.',
    coverage: {
      include: [
        'engine/src/**/*.{js,ts}',
        'data/src/**/*.{js,ts}',
        'src/**/*.{js,ts,tsx}'
      ],
      exclude: ['**/*.d.ts']
    }
  }
})