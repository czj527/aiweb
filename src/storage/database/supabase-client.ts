import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] Missing env vars, using mock client');
    throw new Error('Supabase environment variables are required');
  }
  
  client = createClient(supabaseUrl, supabaseKey);
  return client;
}
