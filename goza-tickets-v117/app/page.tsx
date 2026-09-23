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
  lat: number | null; lon: number | null; buttonColor?: string; accentColor?: string;
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
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { try { setSignedIn(!!localStorage.getItem('gz_portal_session')); } catch {} }, []);
  const [sortBy, setSortBy] = useState<'date' | 'near'>('date');
  const [siteAccent, setSiteAccent] = useState('#c25b6e');

  useEffect(() => {
    trackPageView();
    // instant homepage: render cached list first, refresh in the background
    try {
      const cached = sessionStorage.getItem('gz_browse');
      if (cached) { const d = JSON.parse(cached); setEvents(d.events); if (d.accentColor) setSiteAccent(d.accentColor); }
    } catch { /* ignore */ }
    api('/checkout?browse=1').then((d) => {
      setEvents(d.events); if (d.accentColor) setSiteAccent(d.accentColor);
      try { sessionStorage.setItem('gz_browse', JSON.stringify(d)); } catch { /* full */ }
    }).catch((e) => { try { if (!sessionStorage.getItem('gz_browse')) setErr(e.message); } catch { setErr(e.message); } });
  }, []);

  const askLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setSortBy('near'); },
      () => { /* denied — stay on date sort */ },
      { timeout: 8000 },
    );
  };

  // work the city out of the venue text - no backend change needed
  const cityOf = (e: any) => {
    const t = `${e.location || ''} ${e.name || ''}`.toLowerCase();
    if (t.includes('salt lake') || t.includes('slc')) return 'Salt Lake City';
    if (t.includes('kansas')) return 'Kansas City';
    if (t.includes('atlanta')) return 'Atlanta';
    if (t.includes('east saint louis') || t.includes('east st')) return 'East St. Louis';
    if (t.includes('st. louis') || t.includes('st.louis') || t.includes('saint louis')
      || t.includes('chestnut') || t.includes('mississippi') || t.includes('palenque')) return 'St. Louis';
    return 'More dates';
  };
  const isPast = (e: any) => +new Date(e.date) < Date.now() - 6 * 3600e3;

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
    <div style={{ minHeight: '100vh', background: '#000', backgroundAttachment: 'fixed', fontFamily: F }}>
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
            <img src="/goza-os-logo.png" alt="Goza OS" style={{ height: 30, width: 'auto', display: 'block', margin: '0 0 10px' }} />
            <h1 style={{ color: '#fff', fontFamily: "'Archivo Black',Impact,Haettenschweiler,sans-serif", fontSize: 34, margin: 0, letterSpacing: 0, textTransform: 'uppercase', lineHeight: 1 }}>Upcoming events</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={askLocation}
              style={{ background: sortBy === 'near' ? '#1140F0' : 'linear-gradient(180deg,#1B2130 0%,#11151C 100%)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 999, padding: '11px 18px', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)' }}>
              <span style={{ fontSize: 15 }}>📍</span> {sortBy === 'near' ? 'Nearest first' : 'Near me'}
            </button>
            <a href="/account"
              style={{ background: 'linear-gradient(180deg,#1B2130 0%,#11151C 100%)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', textDecoration: 'none', borderRadius: 999, padding: '11px 18px', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 7, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)' }}>
              <span style={{ fontSize: 15 }}>🎟️</span> {signedIn ? 'My account' : 'Sign in'}
            </a>
          </div>
        </div>

        {err && <p style={{ color: siteAccent, fontSize: 14 }}>Couldn&apos;t load events. {err}</p>}
        {!events && !err && <p style={{ color: '#8a8f98', fontSize: 14 }}>Loading events…</p>}
        {events && list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>No events right now</p>
            <p style={{ color: '#8a8f98', fontSize: 15, margin: 0 }}>Check back soon — new dates drop here.</p>
          </div>
        )}

        {(() => {
          const upcoming = list.filter((e) => !isPast(e));
          const past = list.filter(isPast).slice(0, 8);
          const cities: string[] = [];
          upcoming.forEach((e) => { const c = cityOf(e); if (!cities.includes(c)) cities.push(c); });

          const Card = (e: any, faded = false) => (
            <div key={e.id} style={{ opacity: faded ? 0.45 : 1 }}>
              <a key={e.id} href={`/e?id=${e.id}`} className="gz-card"
              style={{ display: 'block', background: 'linear-gradient(180deg,#141821 0%,#0B0E13 100%)', borderRadius: 18, overflow: 'hidden', border: '1px solid #232936', textDecoration: 'none', boxShadow: '0 14px 34px rgba(0,0,0,0.45)' }}>
              <div style={{ position: 'relative', aspectRatio: '1/1', background: '#111' }}>
                {e.imageUrl
                  ? <img loading="lazy" decoding="async" src={e.imageUrl} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: e.accentColor || siteAccent, fontSize: 40, fontWeight: 800 }}>{e.name[0]}</div>}
                {e.soldOut && <div style={{ position: 'absolute', top: 10, left: 10, background: '#000', color: '#fff', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 10.5, fontWeight: 700, letterSpacing: 1.6, padding: '6px 11px', borderRadius: 999 }}>SOLD OUT</div>}
                {distanceTo(e) && <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 6 }}>{distanceTo(e)}</div>}
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <p style={{ color: e.accentColor || siteAccent, fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 11.5, fontWeight: 700, margin: '0 0 7px', letterSpacing: 1.6, textTransform: 'uppercase' }}>{fmtDate(e.date)}</p>
                <p style={{ color: '#fff', fontFamily: "'Archivo Black',Impact,Haettenschweiler,sans-serif", fontSize: 17, margin: '0 0 6px', lineHeight: 1.15, textTransform: 'uppercase' }}>{e.name}</p>
                <p style={{ color: '#A8B2C1', fontSize: 13.5, margin: '0 0 14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.location}</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                  <span>
                    <span style={{ display: 'block', color: '#8a8f98', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
                      {e.soldOut ? 'Status' : 'From'}
                    </span>
                    <span style={{ color: '#fff', fontFamily: "'Archivo Black',Impact,Haettenschweiler,sans-serif", fontSize: 19, lineHeight: 1 }}>
                      {e.soldOut ? 'SOLD OUT' : e.minPrice != null ? money(e.minPrice) : 'FREE'}
                    </span>
                  </span>
                  <span style={{ background: e.buttonColor || ROSE, color: '#fff', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, boxShadow: '0 6px 16px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.28)', whiteSpace: 'nowrap' }}>Get tickets</span>
                </div>
              </div>
            </a>
            </div>
          );

          return (
            <>
              {cities.map((city) => (
                <div key={city} style={{ marginBottom: 34 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 13 }}>
                    <h2 style={{ margin: 0, fontFamily: "'Archivo Black',Impact,Haettenschweiler,sans-serif", fontSize: 20, textTransform: 'uppercase', color: '#fff' }}>{city}</h2>
                    <span style={{ color: '#6d7787', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 11.5, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                      {upcoming.filter((e) => cityOf(e) === city).length} night{upcoming.filter((e) => cityOf(e) === city).length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="gz-grid">
                    {upcoming.filter((e) => cityOf(e) === city).map((e) => Card(e))}
                  </div>
                </div>
              ))}

              {past.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 26, borderTop: '1px solid #232936' }}>
                  <h2 style={{ margin: '0 0 13px', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: 2.4, textTransform: 'uppercase', color: '#6d7787' }}>
                    Recently played
                  </h2>
                  <div className="gz-grid">
                    {past.map((e) => Card(e, true))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        <p style={{ textAlign: 'center', padding: '40px 0 0' }}>
          <a href="/admin" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, letterSpacing: 2, textDecoration: 'none' }}>ADMIN</a>
        </p>
      </div>
    </div>
  );
}
