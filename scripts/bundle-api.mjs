import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('api', { recursive: true, force: true });

await build({
  entryPoints: {
    assistant: 'server/entries/assistant.ts',
    'funding/[route]': 'server/entries/funding.ts',
  },
  outdir: 'api',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  minify: false,
  legalComments: 'none',
});
