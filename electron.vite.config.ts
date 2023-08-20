import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@common': resolve('src/common')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@common': resolve('src/common')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()]
  }
})
