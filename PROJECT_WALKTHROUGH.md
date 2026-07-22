# Lighthouse — Project Go-Through

A plain-language tour of **what this app is for** and **how it works**, for anyone opening the repo for the first time.

---

## 1. Purpose

**Lighthouse** is a personal wellbeing web app. It helps people:

1. Check in on how they feel each day  
2. Reflect through short guided activities  
3. See simple patterns over time  
4. Keep that data **private** to themselves  

There is also an **Admin Portal** so staff or project owners can monitor overall engagement and gently follow up when someone may need attention — **without reading private journal text**.

Think of it as: *a daily wellbeing journal + guided journey + personal analytics*, with a separate ops/care dashboard for admins.

---

## 2. Who uses it

| Role | What they do |
|------|----------------|
| **User** | Signs up, completes the daily journey, writes reflections, views their own dashboard/insights/reports |
| **Admin** | Signs in via the Admin tab, monitors platform stats, manages scenarios, reviews flagged users, sends soft nudges / watchlist notes |

Admins and users have **separate UIs**. An admin account is redirected to `/admin`; a normal user stays in the personal app.

---

## 3. The daily journey (core loop)

The heart of the product is a **4-step guided journey** for “today”:

```
Daily Check-in  →  Scenario Assessment  →  Visual Reflection  →  Journal
```

1. **Check-in** — sleep, mood, energy, productivity, activity (structured metrics)  
2. **Scenario** — short story + choice (behavioural reflection)  
3. **Visual** — pick an image that matches current mood (Calm, Heavy, Overwhelmed, etc.)  
4. **Journal** — free-text reflection (private)

The **Dashboard** shows “Today’s Progress” (0–4/4) and links to the next incomplete step.

Everything else (insights, reports, trends) builds on this history.

---

## 4. What the user sees

### Landing (`index.html`)
Marketing site plus auth card with three tabs:

- **Login** → personal dashboard  
- **Sign Up** → create account  
- **Admin** → admin portal (admin role required)

### Personal app
- **Dashboard** — progress, real counts (check-ins, journal, active days), charts  
  - Toggle: **Demo Analytics** vs **Real-time Analytics**  
  - Demo fills charts when history is thin (for demos); real mode shows live data or “Not enough data yet”  
- **Check-ins / Scenario / Visual / Journal** — journey steps  
- **Insights** — behavioural patterns from the user’s own data  
- **Reports** — weekly/monthly summary + PDF export  
- **Profile / Settings** — name, avatar, password, theme, preferences  

Privacy rule: users only ever see **their own** rows (enforced by Supabase RLS).

---

## 5. What the admin sees

Admin lives under `/admin/*`:

| Area | Purpose |
|------|---------|
| **Dashboard / Analytics** | Users, activity, growth charts, flagged counts |
| **Users → Care** | Why someone is flagged, notes, soft nudge, 7-day watchlist |
| **Scenarios** | Create / edit / enable / disable scenario bank items |
| **Reports** | Snapshot cards + PDF packs (platform, engagement, flagged care, cohort) |
| **Settings** | Theme (and admin reminders) |

**Important design choice:** admins see attention signals and counts — **not** journal body text. Care is about “reach out gently,” not reading diaries.

Flagging is heuristic (e.g. low mood streaks, poor sleep, inactivity, avoidance patterns). Showcase mode can temporarily mark 1–2 users as Moderate for demos (`SHOWCASE_FLAGGED` in config).

---

## 6. How data flows (simple architecture)

```
Browser (static HTML/CSS/JS)
        │
        │  Supabase JS client (anon key)
        ▼
Supabase Auth  ──►  who is logged in
Supabase Postgres ──►  tables + RLS policies
```

There is **no custom backend server**. The frontend talks to Supabase directly. Security relies on:

- Authentication (session)  
- **Row Level Security** (users can’t read others’ data; admins get limited monitoring access)

Config lives in `assets/js/config.js` (not a `.env` file — this is a static site).

---

## 7. Database (what gets stored)

Migrations in `supabase/` (run in order):

| File | Adds |
|------|------|
| `schema.sql` | Reflections (journal) |
| `schema_wellbeing.sql` | Check-ins, scenario bank + responses, visual reflections |
| `schema_platform.sql` | Profiles (role, status), preferences, admin helpers |
| `schema_care.sql` | Admin notes, user nudges, `monitoring_until` watchlist |

`profiles.role` is either `user` or `admin`. Promoting an admin is a manual SQL update after signup.

---

## 8. Typical paths through the product

### New user
1. Sign up on landing  
2. Land on dashboard (empty / demo charts OK)  
3. Start today’s journey (Check-in → … → Journal)  
4. Over days, Real-time analytics unlock as history grows  

### Demo / presentation
1. Use Demo Analytics on the dashboard so charts look complete  
2. Optionally leave `SHOWCASE_FLAGGED: true` so admin Care has sample flagged users  
3. Export admin PDFs from Admin → Reports  

### Admin care
1. See flagged user on dashboard or Users  
2. Open **Care** → review reasons → note / nudge / watchlist  
3. User may see a soft nudge banner on their dashboard  

---

## 9. What this project is *not*

- Not a clinical diagnosis tool  
- Not a social network  
- Not a Node/React SPA — it’s intentional static pages + Supabase  
- Not a system that lets admins read private journals by default  

---

## 10. How to run it (one-liner reminder)

1. Put Supabase URL + anon key in `assets/js/config.js`  
2. Run the four SQL files in order  
3. `npx --yes serve .`  
4. Open the local URL → Sign Up / Login / Admin  

Details: [`SETUP.md`](./SETUP.md) · Overview for GitHub: [`README.md`](./README.md)

---

## Bottom line

**Lighthouse** helps individuals build a private daily wellbeing habit through a short guided journey, then shows them their own trends. **Admins** watch the platform and support people who look at risk — carefully, without invading journal privacy.

If you only remember one flow, remember this:

> **Check-in → Scenario → Visual → Journal → Dashboard insights**  
> (and separately: **Admin Care** for flagged users)
