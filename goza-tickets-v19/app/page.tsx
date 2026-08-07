'use client';

/*
  HOMEPAGE — browse all published events (Posh/Eventbrite style).
  Grid of event cards with flyer, name, date, venue, from-price.
  "Near me" sorts by distance if the visitor allows location; otherwise
  events show soonest-first. Tapping a card opens /e?id=<eventId>.
*/

import { useState, useEffect } from 'react';
import { api, money, fmtDate, ORGANIZER } from '@/lib/api';
import { trackPageView } from '@/lib/track';

const ROSE = '#c25b6e';
const F = 'Helvetica Neue,Helvetica,Arial,sans-serif';

interface Ev {
  id: string; name: string; date: string; location: string;
  imageUrl: string | null; minPrice: number | null; soldOut: boolean;
  lat: number | null; lon: number | null; buttonColor?: string;
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 3959; // miles
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function Home() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [err, setErr] = useState('');
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'near'>('date');

  useEffect(() => {
    trackPageView();
    api('/checkout?browse=1').then((d) => setEvents(d.events)).catch((e) => setErr(e.message));
  }, []);

  const askLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setSortBy('near'); },
      () => { /* denied — stay on date sort */ },
      { timeout: 8000 },
    );
  };

  let list = events ? [...events] : [];
  if (sortBy === 'near' && me) {
    list.sort((a, b) => {
      const da = a.lat != null && a.lon != null ? haversine(me, { lat: a.lat, lon: a.lon }) : Infinity;
      const db = b.lat != null && b.lon != null ? haversine(me, { lat: b.lat, lon: b.lon }) : Infinity;
      return da - db;
    });
  } else {
    list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }

  const distanceTo = (e: Ev) =>
    sortBy === 'near' && me && e.lat != null && e.lon != null
      ? `${Math.round(haversine(me, { lat: e.lat, lon: e.lon }))} mi away` : null;

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(120% 90% at 50% 0%, #2a1018 0%, #0c0508 55%, #000 100%)', backgroundAttachment: 'fixed', fontFamily: F }}>
      <style>{`
        .gz-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 640px) { .gz-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 960px) { .gz-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .gz-card { transition: transform 0.15s; }
        .gz-card:active { transform: scale(0.98); }
      `}</style>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 18px 60px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ color: ROSE, fontSize: 12, letterSpacing: 3, fontWeight: 700, margin: '0 0 4px' }}>GOZA ENTERTAINMENT</p>
            <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Upcoming events</h1>
          </div>
          <button onClick={askLocation}
            style={{ background: sortBy === 'near' ? ROSE : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', borderRadius: 22, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 15 }}>📍</span> {sortBy === 'near' ? 'Nearest first' : 'Near me'}
          </button>
        </div>

        {err && <p style={{ color: ROSE, fontSize: 14 }}>Couldn&apos;t load events. {err}</p>}
        {!events && !err && <p style={{ color: '#8a8f98', fontSize: 14 }}>Loading events…</p>}
        {events && list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>No events right now</p>
            <p style={{ color: '#8a8f98', fontSize: 15, margin: 0 }}>Check back soon — new dates drop here.</p>
          </div>
        )}

        <div className="gz-grid">
          {list.map((e) => (
            <a key={e.id} href={`/e?id=${e.id}`} className="gz-card"
              style={{ display: 'block', background: 'rgba(14,14,18,0.7)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none' }}>
              <div style={{ position: 'relative', aspectRatio: '1/1', background: '#111' }}>
                {e.imageUrl
                  ? <img src={e.imageUrl} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ROSE, fontSize: 40, fontWeight: 800 }}>{e.name[0]}</div>}
                {e.soldOut && <div style={{ position: 'absolute', top: 10, left: 10, background: '#000', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '5px 10px', borderRadius: 6 }}>SOLD OUT</div>}
                {distanceTo(e) && <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 6 }}>{distanceTo(e)}</div>}
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <p style={{ color: ROSE, fontSize: 12.5, fontWeight: 700, margin: '0 0 6px', letterSpacing: 0.3 }}>{fmtDate(e.date)}</p>
                <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.2 }}>{e.name}</p>
                <p style={{ color: '#a8adb8', fontSize: 13.5, margin: '0 0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.location}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                    {e.soldOut ? 'Sold out' : e.minPrice != null ? `From ${money(e.minPrice)}` : 'Free'}
                  </span>
                  <span style={{ background: e.buttonColor || ROSE, color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 20 }}>Get tickets</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <p style={{ textAlign: 'center', padding: '40px 0 0' }}>
          <a href="/admin" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, letterSpacing: 2, textDecoration: 'none' }}>ADMIN</a>
        </p>
      </div>
    </div>
  );
}
