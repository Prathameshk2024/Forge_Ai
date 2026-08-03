import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        // Firebase and JSZip are large and rarely change - keep them out of the
        // main chunk so app updates stay cheap for returning users.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          zip: ['jszip'],
        },
      },
    },
  },
  server: {
    // WebContainer needs SharedArrayBuffer, which needs cross-origin isolation.
    //
    // COEP is `credentialless` rather than `require-corp` so Firebase Auth's
    // helper iframe on <project>.firebaseapp.com still loads - it sends no
    // Cross-Origin-Resource-Policy header, so `require-corp` blocks it outright
    // and Google sign-in can never complete. `credentialless` keeps the page
    // isolated while loading cross-origin subresources without credentials.
    //
    // COOP must stay `same-origin`: it is what grants isolation. That is also
    // why sign-in uses a redirect and not a popup - see lib/auth.ts.
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  }
});
