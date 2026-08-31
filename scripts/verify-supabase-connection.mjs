import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(projectRoot, 'client/src/lib/supabase.ts'), 'utf8');
const urlMatch = source.match(/const DEFAULT_SUPABASE_URL = '([^']+)'/);
const keyMatch = source.match(/const DEFAULT_SUPABASE_ANON_KEY = '([^']+)'/);

if (!urlMatch || !keyMatch) {
  console.error('No se encontró la configuración predeterminada de Supabase.');
  process.exit(1);
}

const headers = {
  apikey: keyMatch[1],
  Authorization: `Bearer ${keyMatch[1]}`,
};

const checks = [
  { name: 'Auth', url: `${urlMatch[1]}/auth/v1/settings` },
  { name: 'Inspecciones', url: `${urlMatch[1]}/rest/v1/inspection_photos?select=id&limit=1` },
];

let validated = false;
for (const check of checks) {
  const response = await fetch(check.url, { headers });
  const body = (await response.text()).slice(0, 240);
  console.log(`${check.name}: estado ${response.status}${body ? ` — ${body}` : ''}`);
  if (check.name === 'Auth' && response.ok) validated = true;
}

if (!validated) {
  console.error('Supabase no aceptó la credencial para los endpoints comprobados.');
  process.exit(1);
}

console.log('Conexión validada: al menos un endpoint de Supabase respondió correctamente.');
