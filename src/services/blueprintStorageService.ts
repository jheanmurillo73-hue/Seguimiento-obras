/**
 * Diseño: cartografía técnica sobria. Las imágenes del plano se guardan fuera
 * de localStorage para que los controles espaciales no fallen por cuota.
 */
const DATABASE_NAME = 'photovault-media';
const DATABASE_VERSION = 2;
const BLUEPRINT_STORE_NAME = 'blueprints';
const EVIDENCE_STORE_NAME = 'evidences';
const ACTIVE_BLUEPRINT_KEY = 'active-blueprint-image';

/**
 * Storage remoto es la fuente de verdad. IndexedDB solamente actúa como respaldo
 * para permitir abrir el plano sin conexión.
 */
export const resolveBlueprintImage = (
  cloudImage: string | null,
  storedImage: string | null,
): string | null => cloudImage || storedImage || null;

export interface BlueprintRestoreResult {
  cloudImage: string | null;
  storedImage: string | null;
  imageUrl: string | null;
}

export async function restoreBlueprintFromSources(
  loadCloudImage: () => Promise<string | null>,
  loadStoredImage: () => Promise<string | null>,
): Promise<BlueprintRestoreResult> {
  const [cloudResult, storedResult] = await Promise.allSettled([
    loadCloudImage(),
    loadStoredImage(),
  ]);
  const cloudImage = cloudResult.status === 'fulfilled' ? cloudResult.value : null;
  const storedImage = storedResult.status === 'fulfilled' ? storedResult.value : null;

  return {
    cloudImage,
    storedImage,
    imageUrl: resolveBlueprintImage(cloudImage, storedImage),
  };
}

function openBlueprintDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BLUEPRINT_STORE_NAME)) {
        database.createObjectStore(BLUEPRINT_STORE_NAME);
      }
      if (!database.objectStoreNames.contains(EVIDENCE_STORE_NAME)) {
        database.createObjectStore(EVIDENCE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento de planos.'));
  });
}

export async function saveBlueprintImage(imageUrl: string): Promise<void> {
  const database = await openBlueprintDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BLUEPRINT_STORE_NAME, 'readwrite');
    transaction.objectStore(BLUEPRINT_STORE_NAME).put(imageUrl, ACTIVE_BLUEPRINT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar la imagen del plano.'));
    transaction.onabort = () => reject(transaction.error || new Error('El almacenamiento del plano fue interrumpido.'));
  });
  database.close();
}

export async function loadBlueprintImage(): Promise<string | null> {
  const database = await openBlueprintDatabase();
  const imageUrl = await new Promise<string | null>((resolve, reject) => {
    const transaction = database.transaction(BLUEPRINT_STORE_NAME, 'readonly');
    const request = transaction.objectStore(BLUEPRINT_STORE_NAME).get(ACTIVE_BLUEPRINT_KEY);
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error || new Error('No se pudo recuperar la imagen del plano.'));
  });
  database.close();
  return imageUrl;
}

export async function clearBlueprintImage(): Promise<void> {
  const database = await openBlueprintDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BLUEPRINT_STORE_NAME, 'readwrite');
    transaction.objectStore(BLUEPRINT_STORE_NAME).delete(ACTIVE_BLUEPRINT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo eliminar el plano guardado.'));
    transaction.onabort = () => reject(transaction.error || new Error('La eliminación del plano fue interrumpida.'));
  });
  database.close();
}

export function isQuotaExceededError(error: unknown): boolean {
  const errorName = error instanceof DOMException ? error.name : '';
  const errorMessage = error instanceof Error ? error.message : String(error || '');
  return errorName === 'QuotaExceededError' || /quota|storage.*full|exceeded/i.test(errorMessage);
}

export async function saveEvidenceImages(photoId: string, imageUrls: string[]): Promise<void> {
  const database = await openBlueprintDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(EVIDENCE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(EVIDENCE_STORE_NAME);
    if (imageUrls.length > 0) {
      store.put(imageUrls, photoId);
    } else {
      store.delete(photoId);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudieron guardar las evidencias del elemento.'));
    transaction.onabort = () => reject(transaction.error || new Error('El almacenamiento de evidencias fue interrumpido.'));
  });
  database.close();
}

export async function loadEvidenceImages(photoId: string): Promise<string[] | null> {
  const database = await openBlueprintDatabase();
  const imageUrls = await new Promise<string[] | null>((resolve, reject) => {
    const transaction = database.transaction(EVIDENCE_STORE_NAME, 'readonly');
    const request = transaction.objectStore(EVIDENCE_STORE_NAME).get(photoId);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result.filter((url): url is string => typeof url === 'string') : null);
    request.onerror = () => reject(request.error || new Error('No se pudieron recuperar las evidencias del elemento.'));
  });
  database.close();
  return imageUrls;
}

export async function clearEvidenceImages(): Promise<void> {
  const database = await openBlueprintDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(EVIDENCE_STORE_NAME, 'readwrite');
    transaction.objectStore(EVIDENCE_STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudieron eliminar las evidencias locales.'));
    transaction.onabort = () => reject(transaction.error || new Error('La limpieza de evidencias fue interrumpida.'));
  });
  database.close();
}
