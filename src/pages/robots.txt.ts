import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site, url }) => {
  const sitemapUrl = new URL('/sitemap.xml', site ?? url.origin);

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
