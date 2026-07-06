// Feature flag: Google login + player stats. NEXT_PUBLIC_* is inlined at build time,
// so leaving it unset makes every `AUTH_ENABLED && …` branch a compile-time false —
// the auth UI and supabase calls are tree-shaken out and the app behaves as before.
// Flip on by setting NEXT_PUBLIC_FEATURE_AUTH=1 (requires a rebuild/redeploy).
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_FEATURE_AUTH === "1";
