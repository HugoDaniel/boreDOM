import { defineConfig } from 'vite';
import { boredomPlugin } from '@mr_hugo/vite-plugin-boredom';

export default defineConfig({
  plugins: [
    boredomPlugin({
      inlineRuntime: true,
      validateComponents: true,
      optimizeStyles: true
    })
  ],
  
  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
        assetFileNames: '[name].[ext]'
      }
    },
    cssCodeSplit: false,
    assetsInlineLimit: 100000
  },

  server: {
    port: 3000,
    open: true
  }
});
