import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app/common/comment-html': resolve(
        frontendRoot,
        '../libs/common/src/comment-html.ts',
      ),
    },
  },
  server: {
    port: 5173,
  },
});
