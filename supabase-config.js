/* ------------------------------------------------------------
   SUPABASE CONFIG
   ------------------------------------------------------------
   Fill in the two values below from your Supabase project:
   Project Settings -> API -> Project URL / anon public key.

   The anon key is SAFE to expose in client-side code as long as
   Row Level Security (RLS) is enabled on every table — that's
   what sql/rls_policies.sql sets up. Never put a service_role
   key in this file.
------------------------------------------------------------- */

const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
