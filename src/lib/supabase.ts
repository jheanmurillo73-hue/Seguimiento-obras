import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// El anon key se utiliza exclusivamente desde el cliente y debe estar protegido
// por las políticas RLS configuradas en el proyecto Supabase.
const DEFAULT_SUPABASE_URL = 'https://aorhmskjhvdcrrmopzrt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvcmhtc2tqaHZkY3JybW9wenJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDc2MjcsImV4cCI6MjEwMjcyMzYyN30.4kOu7kl0ktfwAnzq0aUbvX4SIzE3fBaRQgj33xdxIFQ';
const CUSTOM_CONFIG_VERSION_KEY = 'photovault_supabase_config_version';
export const SUPABASE_CONFIG_VERSION = '2';

const env = (import.meta as any).env || {};

export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    // Return only the origin (e.g., https://xyz.supabase.co), stripping trailing slashes
    return parsed.origin;
  } catch (e) {
    return url.replace(/\/+$/, '');
  }
}

export function getActiveSupabaseConfig(): { url: string; anonKey: string; isCustom: boolean } {
  const localUrl = localStorage.getItem('photovault_supabase_url') || '';
  const localKey = localStorage.getItem('photovault_supabase_anon_key') || '';
  const customConfigVersion = localStorage.getItem(CUSTOM_CONFIG_VERSION_KEY);
  
  // Las credenciales locales creadas antes de esta versión se ignoran una sola vez.
  // Así los dispositivos que conservan la clave anterior vuelven a usar las variables vigentes.
  if (localUrl && localKey && customConfigVersion === SUPABASE_CONFIG_VERSION) {
    return {
      url: cleanSupabaseUrl(localUrl),
      anonKey: localKey.trim(),
      isCustom: true,
    };
  }

  const rawEnvUrl = (env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const rawEnvKey = (env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

  return {
    url: cleanSupabaseUrl(rawEnvUrl),
    anonKey: rawEnvKey,
    isCustom: false,
  };
}

let supabaseInstance: SupabaseClient | null = null;
let currentClientKey = '';

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getActiveSupabaseConfig();
  if (!url || !anonKey || anonKey.length < 10) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return Boolean(parsed.hostname && parsed.protocol.startsWith('http'));
  } catch {
    return false;
  }
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const { url, anonKey } = getActiveSupabaseConfig();
  const clientKey = `${url}:${anonKey}`;

  if (!supabaseInstance || currentClientKey !== clientKey) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      currentClientKey = clientKey;
    } catch (err) {
      console.warn('Error initializing Supabase client:', err);
      return null;
    }
  }
  return supabaseInstance;
};

export const saveCustomSupabaseConfig = (url: string, anonKey: string) => {
  if (url && anonKey) {
    localStorage.setItem('photovault_supabase_url', cleanSupabaseUrl(url));
    localStorage.setItem('photovault_supabase_anon_key', anonKey.trim());
    localStorage.setItem(CUSTOM_CONFIG_VERSION_KEY, SUPABASE_CONFIG_VERSION);
  } else {
    localStorage.removeItem('photovault_supabase_url');
    localStorage.removeItem('photovault_supabase_anon_key');
    localStorage.removeItem(CUSTOM_CONFIG_VERSION_KEY);
  }
  supabaseInstance = null;
  currentClientKey = '';
};

export const resetSupabaseConfig = () => {
  localStorage.removeItem('photovault_supabase_url');
  localStorage.removeItem('photovault_supabase_anon_key');
  localStorage.removeItem(CUSTOM_CONFIG_VERSION_KEY);
  supabaseInstance = null;
  currentClientKey = '';
};

export const supabase = getSupabaseClient();
export type { User, Session };
