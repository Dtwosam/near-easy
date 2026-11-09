import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { assistantPlugin } from './server/assistantPlugin';
import { tidepoolPlugin } from './server/tidepoolPlugin';

const previewPort = Number(process.env.PORT);

export default defineConfig({
  plugins: [react(), assistantPlugin(), tidepoolPlugin()],
  server: { port: 5173, strictPort: true },
  preview: {
    host: process.env.HOST || '127.0.0.1',
    port: Number.isInteger(previewPort) && previewPort > 0 ? previewPort : 4173,
    strictPort: true,
  },
});
