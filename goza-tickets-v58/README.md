# Goza Tickets — Frontend

Four screens. Talks to the ticketing backend over REST. Holds no secrets,
no database access, no payment credentials.

| Route | What it is |
|---|---|
| `/` | Two-step checkout — quantity, then contact info, then Stripe |
| `/scan` | Full-screen door scanner |
| `/admin` | Fee controls + live door roster |
| `/thanks` | Post-purchase landing |

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:
- `NEXT_PUBLIC_BACKEND_URL` — your deployed backend (no trailing slash)
- `NEXT_PUBLIC_EVENT_ID` and `NEXT_PUBLIC_TICKET_TYPE_ID` — copy from the
  `events` and `ticket_types` tables in Supabase
- Event name, date, venue for display

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
```

## Deploy

Vercel: import the repo, add the same env vars, deploy.

The scanner needs **HTTPS** — browsers block camera access on plain HTTP
except on localhost. Any real deployment gives you HTTPS automatically.

## The scanner

Green means let them in. Red means stop. Everything else is detail.

- Camera stays running between scans. Restarting costs 1-2 seconds each time,
  which compounds into a backed-up line.
- Scans debounce at 2s — a code sitting in frame fires one request, not twenty.
- Phone vibrates on result: 100ms valid, 400ms rejected. Staff feel the answer
  without looking down.
- Result holds 2.5s then returns to camera automatically. No tapping.
- Live counter at the bottom: "142 in · 58 to go"

Staff name is optional but recorded on every scan, so a disputed entry can be
traced to who was on the door.

## Notes

- `/thanks` deliberately shows no QR code. The webhook issues tickets and may
  finish a second or two after Stripe redirects the buyer. Rendering a QR here
  would race it and sometimes show a broken code. The email is the source of
  truth.
- The admin key lives in React state only, never localStorage — so it doesn't
  persist on a shared laptop after the tab closes.
- No secrets belong in this app. Everything sensitive stays server-side.

## Before your first door

Test the scanner on a **real phone**, not the desktop preview. Camera
permissions behave differently and you don't want to discover that with a line
outside.
