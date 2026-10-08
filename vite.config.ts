/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /<repo>/ so we allow a base override via env.
const base = process.env.VITE_BASE ?? '/';

/**
 * Politique de securite du contenu, injectee dans le HTML de production
 * uniquement (le serveur de dev a besoin de scripts en ligne pour le
 * rechargement a chaud). GitHub Pages ne permet pas d'envoyer d'en-tetes
 * HTTP: la balise meta est le seul moyen d'en poser une.
 *
 * Tout est servi par le site lui-meme: scripts, styles, polices et images.
 * Les seules exceptions sont les images en data: (grain du tapis, masques
 * des tampons) et les blob: eventuels.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'jackpot:csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: CONTENT_SECURITY_POLICY,
        },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  base,
  build: {
    // Vite incruste les petits fichiers en data: dans le CSS. Pour les
    // polices, ce serait bloque par la CSP (font-src 'self'): on les garde
    // en fichiers, ce qui permet aussi au service worker de les mettre en
    // cache comme le reste.
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    rolldownOptions: {
      // 404.html est la page que GitHub Pages sert pour toute adresse
      // inconnue: c'est le meme jeu, qui y affiche son ecran "introuvable".
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Jackpot Solitaire',
        short_name: 'Jackpot',
        description:
          'Un Klondike servi sur une table de casino: gagne des jetons, encaisse ou tente le quitte ou double.',
        lang: 'fr',
        theme_color: '#1f6b3b',
        background_color: '#123a24',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Les polices sont decoupees par alphabet: seul le latin sert au jeu.
        globIgnores: ['**/*-{vietnamese,cyrillic,cyrillic-ext,greek}-*.woff2'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
