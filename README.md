# Lighthouse

A personal wellbeing platform with a guided daily journey, private reflections, insights/reports, and a separate **Admin Portal** for platform monitoring and moderate care workflows.

Built as a static frontend (HTML / CSS / JS) on **Supabase** (Auth + Postgres + Row Level Security).

---

## Features

### User app
- **Landing + Auth** — Login, Sign Up, and Admin tabs on the same page  
- **Daily journey** — Check-in → Scenario Assessment → Visual Reflection → Journal  
- **Dashboard** — Today’s progress, live counts, Demo / Real-time analytics toggle  
- **Insights & Reports** — Trends, weekly/monthly summaries, PDF export  
- **Profile & Settings** — Display name, avatar, password, theme, preferences  
- **Dark / Light theme** — Syncs to preferences when signed in  

### Admin portal (`/admin`)
- Dashboard, Users, Scenarios, Reports, Analytics, Settings  
- **Care panel** for flagged users: trigger reasons, internal notes, soft nudge, 7-day watchlist  
- High-value **PDF exports**: Platform Snapshot, Engagement Pack, Flagged Care Summary, User Cohort Summary  
- Journal **text is never shown** in admin views by design  

---

## Tech stack

| Layer | Choice |
|--------|--------|
| UI | HTML, CSS, vanilla JS |
| Charts | Chart.js |
| Auth & DB | Supabase Auth + Postgres |
| PDF | jsPDF (CDN) |
| Hosting | Any static host / local HTTP server |

---

## Project structure

```
├── index.html              # Landing + auth
├── dashboard.html          # User dashboard
├── checkins.html
├── scenario.html
├── visual.html
├── journal.html
├── insights.html
├── reports.html
├── profile.html
├── settings.html
├── admin/                  # Admin portal pages
├── assets/
│   ├── css/
│   └── js/
│       ├── config.js           # Your Supabase keys (do not commit secrets)
│       ├── config.example.js   # Template
│       └── ...
├── supabase/               # SQL migrations (run in order)
├── SETUP.md
└── README.md
```

---

## Quick start

### 1. Clone & configure

```bash
git clone <your-repo-url>
cd "The Lighthouse"
```

Copy the config template and fill in your Supabase project values:

```bash
cp assets/js/config.example.js assets/js/config.js
```

Edit `assets/js/config.js`:

```js
window.LIGHTHOUSE_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',
  SHOWCASE_FLAGGED: true, // set false in production
};
```

Find URL + anon key in: **Supabase → Project Settings → API**.

### 2. Run SQL migrations (in order)

In **Supabase → SQL Editor**, run:

1. `supabase/schema.sql` — reflections  
2. `supabase/schema_wellbeing.sql` — check-ins, scenarios, visual reflections  
3. `supabase/schema_platform.sql` — profiles, preferences, admin RLS  
4. `supabase/schema_care.sql` — admin notes, nudges, watchlist  

### 3. Serve over HTTP

Auth will not work reliably via `file://`. Use a local server:

```bash
npx --yes serve .
```

Open the URL shown (e.g. `http://localhost:3000`).

---

## Creating an admin

1. Sign up a normal account from the landing page.  
2. In Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'YOUR-USER-UUID';
```

Find the UUID under **Authentication → Users**.

3. Use the **Admin** tab on the landing page (or `index.html#admin`) to sign in.  
   Admins are redirected to `/admin/index.html`.

---

## Demo / Real-time analytics

On the user **Dashboard**:

- **Demo Analytics** — believable sample charts when history is thin (for demos)  
- **Real-time Analytics** — live DB data; shows “Not enough data yet” until thresholds are met  

Live counts (journal entries, check-ins, active days, today’s progress, recent reflections) always stay real.

Suggested unlock thresholds (approx.):

- Most trend charts / wellness score: **7+** check-ins  
- Behaviour-style analytics: **10+** active journey days  

---

## Care workflow (admin)

On **Admin → Users → Care**:

1. Review **why flagged** (attention signals only)  
2. Add **internal notes** (admin-only)  
3. Send a **soft nudge** (shown on the user’s dashboard)  
4. Add to a **7-day watchlist** (auto-clears when expired or risk returns to Low)  

`SHOWCASE_FLAGGED: true` in config can mark the first 1–2 non-admin users as Moderate for demos. Set to `false` for production.

---

## Security notes

- Users only access their own wellbeing data via **RLS**.  
- Admins see aggregates / summaries; **reflection text is excluded** from admin UI and PDF packs.  
- Keep `assets/js/config.js` out of public repos if it contains real keys, or use env injection at deploy time. Prefer committing only `config.example.js`.  
- The anon key is public by design; protection comes from RLS policies.

---

## Scripts / pages map

| Page | Purpose |
|------|---------|
| `index.html` | Marketing + Login / Sign Up / Admin |
| `dashboard.html` | Personal overview + analytics toggle |
| `checkins.html` → `scenario.html` → `visual.html` → `journal.html` | Guided daily journey |
| `insights.html` / `reports.html` | Deeper personal analytics + PDF |
| `admin/*` | Platform monitoring & care |

More detail: see [`SETUP.md`](./SETUP.md).

---

## License

Private / academic project unless otherwise specified by the repository owner.
