/*
  Cloudflare Worker — per-event social previews.

  On /e?id=<eventId>, fetch the event's flyer + name from the backend and
  inject Open Graph + Twitter meta tags into the HTML <head>, so shared links
  show that event's flyer (iMessage, Instagram, X, Facebook, WhatsApp).

  Every other path is served straight from static assets unchanged.
  Humans on /e still get the full app — we only add meta tags to the shell.
*/

const BACKEND = 'https://bbkgazcohahycwnwpaav.supabase.co/functions/v1';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only special-case the per-event page; everything else = static assets.
    if (url.pathname === '/e' || url.pathname === '/e/') {
      const eventId = url.searchParams.get('id');
      if (eventId) {
        // Grab the static shell + the event info in parallel.
        const assetReq = new Request(new URL('/e.html', url.origin), request);
        const [assetRes, infoRes] = await Promise.all([
          env.ASSETS.fetch(assetReq),
          fetch(`${BACKEND}/checkout?eventId=${encodeURIComponent(eventId)}&info=1`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        let html = await assetRes.text();
        const ev = infoRes?.event;

        if (ev) {
          const title = esc(ev.name);
          const desc = esc((ev.description || 'Get your tickets now.').split('\n')[0]).slice(0, 200);
          const img = esc(ev.imageUrl || '');
          const pageUrl = esc(url.href);

          const tags = [
            `<meta property="og:type" content="website">`,
            `<meta property="og:site_name" content="Goza Entertainment">`,
            `<meta property="og:title" content="${title}">`,
            `<meta property="og:description" content="${desc}">`,
            img ? `<meta property="og:image" content="${img}">` : '',
            img ? `<meta property="og:image:width" content="1080">` : '',
            img ? `<meta property="og:image:height" content="1350">` : '',
            `<meta property="og:url" content="${pageUrl}">`,
            `<meta name="twitter:card" content="summary_large_image">`,
            `<meta name="twitter:title" content="${title}">`,
            `<meta name="twitter:description" content="${desc}">`,
            img ? `<meta name="twitter:image" content="${img}">` : '',
            `<title>${title} — Goza Entertainment</title>`,
          ].filter(Boolean).join('\n');

          // Inject just before </head>. Also strip the static default <title>.
          html = html.replace(/<title>.*?<\/title>/i, '');
          html = html.replace('</head>', tags + '\n</head>');
        }

        return new Response(html, {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' },
        });
      }
    }

    // Default: serve the static asset for this path.
    return env.ASSETS.fetch(request);
  },
};
