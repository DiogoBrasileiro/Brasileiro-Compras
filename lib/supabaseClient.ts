import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Conexão direta com o Supabase
export const SUPABASE_URL = 'https://fgdlgbwbrtmrzuebxwxv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_lkF56NLnG6M5r_a6bzITDg_vqZJl9uP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});


