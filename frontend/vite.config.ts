import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Set base path - use root for custom domain, repo path for GitHub Pages
  base: process.env.GITHUB_PAGES_CUSTOM_DOMAIN ? '/' : (process.env.NODE_ENV === 'production' ? '/stock_man/' : '/'),
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    quasar({
      sassVariables: 'src/quasar-variables.sass'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    fs: {
      allow: ['..', '../node_modules']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
