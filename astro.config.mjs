// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  integrations: [react()],
  adapter: cloudflare()
});
