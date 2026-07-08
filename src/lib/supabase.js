import { createClient } from "@supabase/supabase-js";
import { getAccessTokenForSupabase } from "@/lib/auth-session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: getAccessTokenForSupabase,
  auth: authOptions,
});

export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authOptions,
});
