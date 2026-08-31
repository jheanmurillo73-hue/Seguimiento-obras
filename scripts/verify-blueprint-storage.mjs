import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const mapView = readFileSync(resolve(projectRoot, 'client/src/components/MapView.tsx'), 'utf8');
const storageService = readFileSync(resolve(projectRoot, 'client/src/services/blueprintStorageService.ts'), 'utf8');

const expectedMapViewFragments = [
  "import { compressImageForDevice } from '../services/deviceStorageService'",
  "import { isQuotaExceededError, loadBlueprintImage, saveBlueprintImage } from '../services/blueprintStorageService'",
  'const { imageUrl, ...metadata } = blueprint',
  "localStorage.setItem('photovault_blueprint', JSON.stringify({ ...metadata, imageUrl: '' }))",
  'await saveBlueprintImage(imageUrl)',
  'const optimizedImage = await compressImageForDevice(file, 2048, 1536, 0.82)',
  "setBlueprintStorageNotice('El plano sigue abierto",
];

const expectedServiceFragments = [
  "const DATABASE_NAME = 'photovault-media'",
  "const STORE_NAME = 'blueprints'",
  'window.indexedDB.open(DATABASE_NAME, 1)',
  'export async function saveBlueprintImage',
  'export async function loadBlueprintImage',
  'export function isQuotaExceededError',
];

const failures = [];
for (const fragment of expectedMapViewFragments) {
  if (!mapView.includes(fragment)) failures.push(`MapView.tsx: falta «${fragment}»`);
}
for (const fragment of expectedServiceFragments) {
  if (!storageService.includes(fragment)) failures.push(`blueprintStorageService.ts: falta «${fragment}»`);
}

if (mapView.includes("localStorage.setItem('photovault_blueprint', JSON.stringify(blueprint))")) {
  failures.push('MapView.tsx: aún intenta guardar el plano completo en localStorage.');
}

if (failures.length > 0) {
  console.error('La validación de almacenamiento del plano falló:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Validación superada: la imagen del plano se optimiza y se persiste fuera de localStorage.');
