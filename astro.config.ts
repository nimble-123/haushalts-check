import { createHash } from 'node:crypto';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { THEMA_START } from './src/scripts/thema-start.ts';

// Hash des Inline-Skripts im <head>; alle übrigen Skripte und Styles hasht Astro selbst
const themaHash = `sha256-${createHash('sha256').update(THEMA_START).digest('base64')}` as const;

// https://astro.build/config
export default defineConfig({
  // Produktions-URL: Grundlage für canonical, og:url und die Sitemap
  site: 'https://haushalts-check.vercel.app',
  trailingSlash: 'always',
  integrations: [sitemap()],
  security: {
    // Content-Security-Policy als <meta> je Seite; frame-ancestors usw. kommen als Header aus vercel.json
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        // Vite bettet sehr kleine Schrift-Untermengen als data:-URL ins CSS ein
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { hashes: [themaHash] },
      // style-Attribute (Farbfelder, Balkenbreiten per innerHTML) erlauben, <style>-Blöcke nur per Hash
      styleDirective: { resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },
});
