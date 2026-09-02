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

function eventJsonLd(ev, eventId, info) {
  try {
    const types = (info && info.ticketTypes) || [];
    const prices = types.map((t) => Number(t.price)).filter((n) => isFinite(n));
    const low = prices.length ? Math.min(...prices) : null;
    const high = prices.length ? Math.max(...prices) : null;
    const anyLeft = types.some((t) => (t.remaining === undefined || t.remaining === null) ? true : t.remaining > 0);
    const locParts = String(ev.location || '').split(',').map((x) => x.trim());
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: ev.name,
      startDate: ev.date || undefined,
      endDate: ev.endDate || undefined,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      description: (ev.description || `${ev.name} — presented by Goza Entertainment.`).slice(0, 500),
      image: ev.imageUrl ? [ev.imageUrl] : undefined,
      location: {
        '@type': 'Place',
        name: locParts[0] || ev.location,
        address: { '@type': 'PostalAddress', streetAddress: locParts.slice(1).join(', ') || undefined, addressLocality: locParts[locParts.length - 2] || undefined, addressCountry: 'US' },
      },
      organizer: { '@type': 'Organization', name: 'Goza Entertainment', url: 'https://tickets.gozaentertainment.com' },
      offers: low !== null ? {
        '@type': 'AggregateOffer',
        url: `https://tickets.gozaentertainment.com/e?id=${eventId}`,
        priceCurrency: 'USD',
        lowPrice: low,
        highPrice: high,
        availability: anyLeft ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
        validFrom: undefined,
      } : undefined,
    };
    return `<script type="application/ld+json">${JSON.stringify(ld)}</scr` + `ipt>`;
  } catch { return ''; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Short links: /t/<code> -> look up the event and 302 to /e?id=<id>.
    // Keeps SMS links tiny (tickets.desenfocado.net/t/9c3b4b).
    if (url.pathname.startsWith('/t/')) {
      const code = url.pathname.slice(3).replace(/\/+$/, '').toLowerCase();
      if (code) {
        try {
          const backend = 'https://bbkgazcohahycwnwpaav.supabase.co/functions/v1';
          const r = await fetch(`${backend}/shortlink?code=${encodeURIComponent(code)}`);
          const d = await r.json();
          if (d && d.found && d.id) {
            return Response.redirect(`${url.origin}/e?id=${d.id}`, 302);
          }
        } catch (_e) { /* fall through */ }
      }
      // unknown code -> send them to the homepage
      return Response.redirect(`${url.origin}/`, 302);
    }

    // SEO: dynamic sitemap of all published events + robots.txt
    if (url.pathname === '/sitemap.xml') {
      let items = '';
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
        const r = await fetch(`${BACKEND}/checkout?browse=1`, { signal: ctl.signal });
        clearTimeout(t);
        if (r.ok) {
          const d = await r.json();
          items = (d.events || []).map((e) =>
            `<url><loc>https://tickets.gozaentertainment.com/e?id=${e.id}</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`
          ).join('');
        }
      } catch {}
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://tickets.gozaentertainment.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>${items}</urlset>`;
      return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
    }
    if (url.pathname === '/robots.txt') {
      return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /scanner\nDisallow: /thanks\nSitemap: https://tickets.gozaentertainment.com/sitemap.xml\n`, { headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=3600' } });
    }

    // Only special-case the per-event page; everything else = static assets.
    if (url.pathname === '/e' || url.pathname === '/e/') {
      const eventId = url.searchParams.get('id');
      if (eventId) {
        // Grab the static shell + the event info in parallel. The info fetch is ONLY
        // for social-share meta tags, so it must never hold up the page: 1.2s max,
        // then we serve the shell as-is (the app fetches its own data client-side).
        // Cloudflare Assets 307-redirects .html URLs to extensionless paths, so try
        // extensionless FIRST and only accept a real page (has </head>).
        const fetchShell = async () => {
          for (const p of ['/e-shell', '/e-shell.html', '/e.html']) {
            try {
              const res = await env.ASSETS.fetch(new Request(new URL(p, url.origin), request));
              if (res.ok) { const t = await res.text(); if (t.includes('</head>')) return t; }
            } catch {}
          }
          return null;
        };
        const infoWithTimeout = (async () => {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 2000);
          try {
            const r = await fetch(`${BACKEND}/checkout?eventId=${encodeURIComponent(eventId)}&info=1`, { signal: ctl.signal });
            return r.ok ? await r.json() : null;
          } catch { return null; }
          finally { clearTimeout(t); }
        })();
        const [shellHtml, infoRes] = await Promise.all([
          fetchShell(),
          infoWithTimeout,
        ]);
        // no usable shell -> hand the request straight to assets, never a blank page
        if (!shellHtml) return env.ASSETS.fetch(request);

        let html = shellHtml;
        const ev = infoRes?.event;

        try {
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
            `<title>${title} — Tickets — Goza Entertainment</title>`,
            `<meta name="description" content="${desc}">`,
            `<link rel="canonical" href="https://tickets.gozaentertainment.com/e?id=${encodeURIComponent(eventId)}">`,
            eventJsonLd(ev, eventId, infoRes),
          ].filter(Boolean).join('\n');

          // Inject just before </head>. Also strip the static default <title>.
          html = html.replace(/<title>.*?<\/title>/i, '');
          html = html.replace('</head>', tags + '\n</head>');
        }
        } catch (e) { console.log('meta inject failed', e && e.message); }

        return new Response(html, {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60', 'x-gz-worker': '1' },
        });
      }
    }

    // Default: serve the static asset for this path.
    return env.ASSETS.fetch(request);
  },
};
