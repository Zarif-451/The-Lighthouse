# Lighthouse — Supabase Setup Guide

## Credentials

Edit `assets/js/config.js` with your Project URL and anon key.

## SQL migrations (run in order)

1. `supabase/schema.sql` — reflections  
2. `supabase/schema_wellbeing.sql` — check-ins, scenarios, visual reflections  
3. `supabase/schema_platform.sql` — profiles, preferences, admin RLS, scenario `is_active`  
4. `supabase/schema_care.sql` — admin notes, soft nudges, watchlist (`monitoring_until`)
5. `supabase/schema_profile_extended.sql` — signup profile fields (phone, DOB, gender, occupation, interests, bio, etc.)

## Admin access (same page as user login)

1. Promote a user to admin (SQL):

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR-USER-UUID';
```

2. On the Landing Page auth card, use the tabs:

   - **Login** — personal user dashboard  
   - **Sign Up** — create a user account  
   - **Admin** — sign in as admin → Admin Portal  

3. You can also open `index.html#admin` or the footer **Admin Login** link.

### Rules

- Admin tab rejects non-admin accounts.
- Admin accounts land on `/admin/index.html`.
- Users cannot open `/admin/*` pages.

## Theme

- Toggle is in the top bar on every page.  
- Preference syncs to `user_preferences.theme` when logged in.  
- Also stored in `localStorage` (`lh_theme`).

## Serve over HTTP

```bash
npx --yes serve .
```

Do not use `file://` for Auth testing.

## Feature checklist

- User: Dashboard, Check-ins, Journal, Insights, Reports, Profile, Settings  
- Journey: Check-in → Scenario → Visual → Journal  
- Admin: Dashboard, Users, Scenarios, Reports, Analytics, Settings  
- Admin Moderate care (Users → **Care**): flag reasons, internal notes, soft nudge, 7-day watchlist  
- Showcase: `SHOWCASE_FLAGGED: true` in `assets/js/config.js` marks the first 1–2 non-admin users as Moderate (set `false` for production)  
- Dark / Light mode across all pages  
