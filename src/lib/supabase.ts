import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Lazy singleton for browser use
let _client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null
  if (!_client) {
    _client = createBrowserClient(supabaseUrl, supabaseKey)
  }
  return _client
}

// Check if Supabase is configured
export function isSupabaseReady(): boolean {
  return !!(supabaseUrl && supabaseKey)
}
