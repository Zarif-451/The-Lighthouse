/* ==========================================================================
   Lighthouse — Supabase configuration
   --------------------------------------------------------------------------
   Fill in your Supabase project values below, then reload the app.
   Find these in: Supabase Dashboard → Project Settings → API
   ========================================================================== */

window.LIGHTHOUSE_CONFIG = {
  // e.g. "https://xxxxxxxx.supabase.co"
  SUPABASE_URL: 'https://ieoprkxzjsaojwjlntjk.supabase.co',

  // e.g. "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllb3Bya3h6anNhb2p3amxudGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTk0NjAsImV4cCI6MjEwMDI5NTQ2MH0.QzC8RVpCPK-VUqz8fu4cB-oeyvjL3VFwGMSReFxcN5M',

  // Demo: force 1–2 non-admin users into Moderate so Care actions can be tested.
  // Set to false for production / real risk only.
  SHOWCASE_FLAGGED: true,
};
