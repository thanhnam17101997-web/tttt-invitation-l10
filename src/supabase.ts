import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export function assertSupabaseConfig(): void {
  if (!url || !publishableKey) {
    throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_PUBLISHABLE_KEY trong .env.local');
  }
}

// Do not throw during module evaluation: otherwise boot cannot show its real
// error/retry UI. Public invitation loading calls assertSupabaseConfig first.
export const supabase = createClient(
  url || 'https://missing-project.supabase.co',
  publishableKey || 'missing-publishable-key',
);
