/**
 * Sincroniza archivos pesados con Supabase Storage. IndexedDB conserva una
 * copia local para que el plano y las evidencias sigan disponibles sin red.
 */
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

export const SUPABASE_MEDIA_BUCKET = 'photovault-media';
const ACTIVE_BLUEPRINT_PATH = 'blueprints/active-plan.jpg';

export interface BlueprintRevision {
  url: string;
  updatedAt: string | null;
  updatedByName: string | null;
  version: string | null;
}

export interface BlueprintUploadAuthor {
  id: string;
  name: string;
}

const isEmbeddedImage = (url: string) => url.startsWith('data:image/') && !url.startsWith('data:image/svg+xml');
const RETRY_ATTEMPTS = 2;

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export const isSupabaseStorageUrl = (url?: string): boolean =>
  Boolean(url && url.includes(`/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/`));

const getPublicUrl = (path: string): string | null => {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = client.storage.from(SUPABASE_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
};

const addCacheVersion = (url: string, version?: string | null): string => {
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

export const createBlueprintMetadata = (author?: BlueprintUploadAuthor): Record<string, string> => ({
  ...(author?.id ? { updatedById: author.id } : {}),
  ...(author?.name ? { updatedByName: author.name } : {}),
  updatedAt: new Date().toISOString(),
});

const uploadEmbeddedImage = async (
  source: string,
  path: string,
  metadata?: Record<string, string>,
): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!isEmbeddedImage(source)) return null;
  if (!client || !isSupabaseConfigured()) {
    throw new Error('Supabase Storage no está configurado o no hay una sesión autenticada.');
  }

  const response = await fetch(source);
  const blob = await response.blob();
  const contentType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    const { error } = await client.storage.from(SUPABASE_MEDIA_BUCKET).upload(path, blob, {
      upsert: true,
      contentType,
      cacheControl: '3600',
      metadata,
    });
    if (!error) return getPublicUrl(path);
    lastError = new Error(error.message);
    if (attempt < RETRY_ATTEMPTS) await wait(500 * attempt);
  }

  throw lastError || new Error('No se pudo cargar el archivo a Supabase Storage.');
};

export async function uploadBlueprintToSupabase(
  source: string,
  author?: BlueprintUploadAuthor,
): Promise<string | null> {
  return uploadEmbeddedImage(source, ACTIVE_BLUEPRINT_PATH, createBlueprintMetadata(author));
}

export async function getCloudBlueprintRevision(): Promise<BlueprintRevision | null> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return null;
  const { data, error } = await client.storage.from(SUPABASE_MEDIA_BUCKET).list('blueprints', {
    limit: 10,
    search: 'active-plan.jpg',
  });
  const blueprintFile = data?.find((file) => file.name === 'active-plan.jpg');
  if (error || !blueprintFile) return null;
  const publicUrl = getPublicUrl(ACTIVE_BLUEPRINT_PATH);
  if (!publicUrl) return null;

  const metadata = (blueprintFile.metadata || {}) as Record<string, unknown>;
  const metadataString = (key: string): string | null =>
    typeof metadata[key] === 'string' && metadata[key].trim() ? metadata[key].trim() : null;
  const updatedAt = blueprintFile.updated_at || blueprintFile.created_at || metadataString('lastModified') || metadataString('updatedAt');
  const updatedByName = typeof metadata.updatedByName === 'string' && metadata.updatedByName.trim()
    ? metadata.updatedByName.trim()
    : null;
  const version = updatedAt || metadataString('eTag') || blueprintFile.id;

  return {
    url: addCacheVersion(publicUrl, version),
    updatedAt,
    updatedByName,
    version,
  };
}

export async function getCloudBlueprintUrl(): Promise<string | null> {
  return (await getCloudBlueprintRevision())?.url || null;
}

export async function uploadEvidenceToSupabase(photoId: string, imageUrls: string[]): Promise<string[]> {
  const containsLocalEvidence = imageUrls.some(isEmbeddedImage);
  if (!isSupabaseConfigured() && containsLocalEvidence) {
    throw new Error('No hay conexión configurada con Supabase Storage para cargar las evidencias.');
  }
  const uploadedUrls = await Promise.all(imageUrls.map(async (imageUrl, index) => {
    if (isSupabaseStorageUrl(imageUrl)) return imageUrl;
    if (!isEmbeddedImage(imageUrl)) return imageUrl;
    const extension = imageUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    return uploadEmbeddedImage(imageUrl, `evidences/${photoId}/${String(index + 1).padStart(2, '0')}.${extension}`);
  }));
  return uploadedUrls.filter((url): url is string => Boolean(url));
}

export async function removeEvidenceFromSupabase(photoId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return;
  const { data, error } = await client.storage.from(SUPABASE_MEDIA_BUCKET).list(`evidences/${photoId}`);
  if (error || !data?.length) return;
  await client.storage.from(SUPABASE_MEDIA_BUCKET).remove(data.map((file) => `evidences/${photoId}/${file.name}`));
}
