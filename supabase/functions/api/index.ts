// Point d'entree de la fonction Supabase "api". Toute la logique vit dans
// handler.js, genere par `npm run api:build` a partir de server/api.ts.

// @ts-types="./handler.d.ts"
import { createHandler } from './handler.js';

const handler = createHandler({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
});

Deno.serve(handler);
