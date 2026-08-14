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

const SUPABASE_URL = "https://zdprlszufsztritblpsb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcHJsc3p1ZnN6dHJpdGJscHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTY1ODAsImV4cCI6MjA5ODQzMjU4MH0.70S3rg74GN09VIP-S5yuJAYVn2n4dOPT3HR0ZDLcy8k";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
