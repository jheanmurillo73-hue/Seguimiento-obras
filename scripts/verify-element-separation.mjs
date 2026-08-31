import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');

const checks = [
  {
    file: 'client/src/components/UploadPhotoView.tsx',
    expected: [
      "const [elementType, setElementType] = useState<ElementType>('caja')",
      "cameraCode: elementType === 'camara' ? cameraCode : undefined",
      "tramo: elementType === 'tuberia' ? tramo.trim() || undefined : undefined",
      "{elementType === 'camara' && (",
      "{elementType === 'tuberia' && (",
    ],
  },
  {
    file: 'client/src/components/EditPhotoModal.tsx',
    expected: [
      'const [elementType, setElementType] = useState<ElementType>(() => getElementType(photo))',
      "cameraType: elementType === 'camara' ? cameraType : undefined",
      "metraje: elementType === 'tuberia' ? metraje.trim() || undefined : undefined",
    ],
  },
  {
    file: 'client/src/components/MapView.tsx',
    expected: [
      "getElementType(p) !== 'tuberia'",
      "getElementType(photo) !== 'tuberia'",
      "if (elementType === 'tuberia' || !photo.latitude || !photo.longitude) return null",
      "{isCamera ? photo.cameraCode || 'Cámara' : 'Caja'}",
    ],
  },
  {
    file: 'client/src/components/PhotoDetailView.tsx',
    expected: [
      'const elementType = getElementType(photo)',
      "{elementType === 'camara' && (",
      "{elementType === 'tuberia' && (",
    ],
  },
];

const failures = [];

for (const { file, expected } of checks) {
  const content = readFileSync(resolve(projectRoot, file), 'utf8');
  for (const fragment of expected) {
    if (!content.includes(fragment)) {
      failures.push(`${file}: falta «${fragment}»`);
    }
  }
}

if (failures.length > 0) {
  console.error('La validación de separación de elementos falló:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Validación superada: cajas, cámaras y tuberías conservan flujos y capas independientes.');
