import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = {
  dashboard: readFileSync(resolve(root, 'client/src/components/DashboardView.tsx'), 'utf8'),
  editModal: readFileSync(resolve(root, 'client/src/components/EditPhotoModal.tsx'), 'utf8'),
  map: readFileSync(resolve(root, 'client/src/components/MapView.tsx'), 'utf8'),
  app: readFileSync(resolve(root, 'client/src/App.tsx'), 'utf8'),
};

const expectations = [
  ['dashboard', "value={photo.name ?? ''}"],
  ['editModal', "useState(photo.name ?? '')"],
  ['editModal', "useState(photo.fieldNotes ?? '')"],
  ['editModal', 'useState(photo.requiresImmediateAction ?? false)'],
  ['editModal', 'useState(photo.verified ?? false)'],
  ['map', 'checked={Boolean(blueprint.visible)}'],
  ['map', 'value={blueprint.opacity ?? 0.7}'],
  ['app', 'const normalizeSettings ='],
  ['app', 'const normalizeInspectionPhoto ='],
  ['app', '.map(normalizeInspectionPhoto)'],
  ['app', 'setSettings(normalizeSettings(backupData.settings))'],
];

const missing = expectations
  .filter(([file, expected]) => !files[file].includes(expected))
  .map(([file, expected]) => `${file}: falta ${expected}`);

if (missing.length) {
  console.error(`Validación de campos controlados falló:\n${missing.join('\n')}`);
  process.exit(1);
}

console.log('Validación superada: los campos persistidos usan valores definidos.');
