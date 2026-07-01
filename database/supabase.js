/**
 * Placeholder Supabase client module.
 *
 * Keep public project values in deployment environment variables instead of
 * hard-coding them here. This static-first module can later be expanded when
 * the site adds authentication, client portals, or content backed by Supabase.
 */
export function createSupabaseClient() {
  const supabaseUrl = globalThis?.SUPABASE_URL ?? '';
  const supabasePublishableKey = globalThis?.SUPABASE_PUBLISHABLE_KEY ?? '';

  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
    status: 'placeholder-client'
  };
}
