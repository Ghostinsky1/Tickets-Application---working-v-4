export const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ||
  'https://bbkgazcohahycwnwpaav.supabase.co/functions/v1';

// Default event: what "/" shows. Every other event lives at /e?id=<eventId>.
export const DEFAULT_EVENT_ID =
  process.env.NEXT_PUBLIC_EVENT_ID || 'f043269e-ab46-40b5-956c-e48c26731c07';

export const ORGANIZER = {
  name: 'GOZA ENTERTAINMENT',
  from: 'St. Louis, MO',
  instagram: 'https://instagram.com',
  email: 'support@gozaentertainment.com',
};

/* One fetch wrapper so no screen can silently swallow a failure. */
export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  let body: any = null;
  try { body = await res.json(); }
  catch { throw new Error(`Server returned ${res.status} with no readable response`); }
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

export const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export function fmtDate(iso?: string | null) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      + ' at ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return iso; }
}

/* Compat exports for the scanner page. */
export const C = {
  bg: '#0a0a0c', card: '#141418', line: 'rgba(255,255,255,0.1)',
  red: '#c25b6e', green: '#3ddc84', muted: '#8a8f98', faint: '#6f747d',
};
export const EVENT = { id: DEFAULT_EVENT_ID, name: 'Goza Event' };
