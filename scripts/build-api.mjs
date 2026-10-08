// Empaquette la fonction serveur (server/api.ts + coeur du jeu + client
// Supabase) en un seul module, charge par supabase/functions/api/index.ts.
// Les regles du jeu sont ainsi exactement celles du navigateur.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [resolve(root, 'server/api.ts')],
  outfile: resolve(root, 'supabase/functions/api/handler.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'warning',
  banner: {
    js: '// Fichier genere par scripts/build-api.mjs: ne pas modifier a la main.',
  },
});
console.log('Fonction api empaquetee.');
