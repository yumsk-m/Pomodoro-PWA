// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://pomodoro.yumsk-m.workers.dev',
  integrations: [react()],
  adapter: cloudflare(),
});
