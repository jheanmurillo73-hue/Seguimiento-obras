import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(projectRoot, 'client/src/lib/supabase.ts'), 'utf8');
const url = source.match(/const DEFAULT_SUPABASE_URL = '([^']+)'/)?.[1];
const anonKey = source.match(/const DEFAULT_SUPABASE_ANON_KEY = '([^']+)'/)?.[1];

if (!url || !anonKey) {
  console.error('No se encontró la configuración de Supabase.');
  process.exit(1);
}

const response = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
});

if (!response.ok) {
  console.error(`No se pudo consultar la configuración de Auth (HTTP ${response.status}).`);
  process.exit(1);
}

const settings = await response.json();
const diagnostic = {
  disable_signup: settings.disable_signup ?? null,
  mailer_autoconfirm: settings.mailer_autoconfirm ?? null,
  phone_autoconfirm: settings.phone_autoconfirm ?? null,
  email_provider_enabled: settings.external?.email ?? null,
  smtp_configured: settings.smtp_admin_email ? true : null,
  site_url: settings.site_url ?? null,
  uri_allow_list: settings.uri_allow_list ?? null,
};

console.log(JSON.stringify(diagnostic, null, 2));
