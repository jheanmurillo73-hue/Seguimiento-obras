import { getSupabaseClient, isSupabaseConfigured, getActiveSupabaseConfig } from '../lib/supabase';
import {
  ActaItem,
  EvidenceTimelineEntry,
  InspectionPhoto,
  InspectorProfile,
  ActivityItem,
  InspectionCollection,
  AppSettings,
  AppModule,
  AppRole,
  UserAccess,
  ElementType,
  getElementType,
  normalizeEvidenceTimeline,
  normalizePipeConduits,
  getPhotoNetworkInfo,
  getPipeNetworkOption,
  PipeNetworkType,
  getElementSector,
  getPhotoProgressPercentage,
  getPhotoRealLinearMeters,
} from '../types';
import { ALL_OPERATIONAL_MODULES, createFallbackAccess, isPrimaryAdmin, normalizeModules } from '../lib/accessControl';
import { removeEvidenceFromSupabase, uploadEvidenceToSupabase } from './supabaseStorageService';
import {
  saveElementProgress,
  getElementProgress,
  encodeProgressInFieldNotes,
  decodeProgressFromFieldNotes,
} from '../lib/elementProgressStorage';

const isElementType = (value: unknown): value is ElementType =>
  value === 'caja' || value === 'camara' || value === 'tuberia' || value === 'electrico';

const parseEvidenceTimeline = (value: unknown, fallback?: string, fallbackDate?: string): EvidenceTimelineEntry[] => {
  const defaultDate = fallbackDate || new Date().toISOString();
  const parseEntries = (candidate: unknown): EvidenceTimelineEntry[] => {
    if (!Array.isArray(candidate)) return [];
    return candidate.flatMap((entry) => {
      if (typeof entry === 'string' && entry.trim()) return [{ url: entry, capturedAt: defaultDate }];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const item = entry as Partial<EvidenceTimelineEntry>;
      return typeof item.url === 'string' && item.url.trim()
        ? [{ url: item.url, capturedAt: typeof item.capturedAt === 'string' && item.capturedAt.trim() ? item.capturedAt : defaultDate }]
        : [];
    });
  };

  if (Array.isArray(value)) return parseEntries(value);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parseEntries(parsed);
    } catch {
      return fallback ? [{ url: fallback, capturedAt: defaultDate }] : [];
    }
  }
  return fallback ? [{ url: fallback, capturedAt: defaultDate }] : [];
};

const serializePhotoToSupabaseRow = (
  photo: InspectionPhoto,
  cloudImageUrl: string,
  cloudEvidenceUrls: string[],
  userId?: string
) => {
  const elementType = getElementType(photo);
  const networkInfo = getPhotoNetworkInfo(photo);
  const isPipe = elementType === 'tuberia';

  const resolvedPipeNetwork: PipeNetworkType | null = isPipe
    ? (photo.pipeNetworkType || photo.pipeConduits?.[0]?.networkType || (
        networkInfo.primary === 'DATOS' ? 'datos' :
        networkInfo.primary === 'BT' ? 'baja_tension' : 'media_tension'
      ))
    : null;

  const resolvedPipeConduits = isPipe
    ? (Array.isArray(photo.pipeConduits) && photo.pipeConduits.length > 0
        ? normalizePipeConduits(photo.pipeConduits)
        : [{
            id: `conduit-${photo.id}`,
            networkType: resolvedPipeNetwork || 'media_tension',
            configuration: photo.tramo || '',
            meters: photo.metraje !== undefined ? Number(photo.metraje) : 0,
          }])
    : [];

  const resolvedCameraType = elementType === 'camara'
    ? (photo.cameraType || networkInfo.primary || 'MT')
    : null;

  const sectorInfo = getElementSector(photo.name);
  const resolvedSector = photo.sector || sectorInfo.label;
  const resolvedSectorCode = photo.sectorCode || sectorInfo.code;

  const progressPercentage = getPhotoProgressPercentage(photo);
  saveElementProgress(photo.id, progressPercentage);
  const encodedFieldNotes = encodeProgressInFieldNotes(photo.fieldNotes, progressPercentage);
  const realLinearMeters = isPipe ? getPhotoRealLinearMeters(photo).totalLinearMeters : null;

  return {
    id: photo.id,
    display_id: photo.displayId,
    name: photo.name,
    sector: resolvedSector,
    sector_code: resolvedSectorCode,
    image_url: cloudImageUrl,
    image_urls: serializeEvidenceTimeline(photo, cloudEvidenceUrls),
    date: photo.date,
    date_raw: photo.dateRaw,
    status: photo.status,
    execution_status: photo.executionStatus,
    progress_percentage: progressPercentage,
    linear_meters: realLinearMeters,
    category: photo.category,
    category_label: photo.categoryLabel,
    location: photo.location,
    element_type: elementType,
    camera_code: elementType === 'camara' ? photo.cameraCode || 'SB850' : null,
    camera_type: resolvedCameraType,
    acta: photo.acta || null,
    acta_item: photo.actaItems?.length ? photo.actaItems : photo.actaItem || null,
    show_acta_label: photo.showActaLabel ?? true,
    acta_label_position: photo.actaLabelPosition || 'derecha',
    tramo: photo.tramo || null,
    metraje: photo.metraje !== undefined ? String(photo.metraje) : null,
    pipe_network_type: resolvedPipeNetwork,
    pipe_color: isPipe ? (photo.pipeColor || getPipeNetworkOption(resolvedPipeNetwork || undefined).color) : null,
    pipe_conduits: resolvedPipeConduits,
    plan_area: photo.planArea || 'civil',
    electrical_type: photo.electricalType || null,
    electrical_color: photo.electricalColor || null,
    cable_type: photo.cableType || null,
    cable_gauge: photo.cableGauge || null,
    cable_meters: photo.cableMeters !== undefined ? String(photo.cableMeters) : null,
    inspector_name: photo.inspectorName,
    inspector_id: photo.inspectorId,
    inspector_avatar: photo.inspectorAvatar,
    type: photo.type,
    verified: photo.verified,
    field_notes: encodedFieldNotes,
    requires_immediate_action: photo.requiresImmediateAction || false,
    file_size: photo.fileSize || '1.4 MB',
    resolution: photo.resolution || '1920x1080',
    plan_x: photo.planX ?? null,
    plan_y: photo.planY ?? null,
    plan_end_x: photo.planEndX ?? null,
    plan_end_y: photo.planEndY ?? null,
    user_id: userId || photo.inspectorId,
    updated_at: new Date().toISOString(),
  };
};

const serializeEvidenceTimeline = (photo: InspectionPhoto, urls: string[]): string => {
  const sourceTimeline = normalizeEvidenceTimeline(photo);
  const fallbackDate = photo.dateRaw || new Date().toISOString();
  return JSON.stringify(urls.map((url, index) => ({ url, capturedAt: sourceTimeline[index]?.capturedAt || fallbackDate })));
};

const parsePipeConduits = (value: unknown) => {
  if (Array.isArray(value)) return normalizePipeConduits(value);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    return normalizePipeConduits(JSON.parse(value));
  } catch {
    return [];
  }
};

const parseActaItem = (value: unknown): ActaItem | undefined => {
  if (!value) return undefined;
  let candidate = value;
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;
  const item = candidate as Partial<ActaItem>;
  if (typeof item.code !== 'string' || typeof item.description !== 'string') return undefined;
  return {
    code: item.code,
    description: item.description,
    unit: typeof item.unit === 'string' ? item.unit : '',
    quantity: typeof item.quantity === 'string' ? item.quantity : '',
    section: typeof item.section === 'string' ? item.section : 'Sin categoría',
  };
};

const parseActaItems = (value: unknown, fallback?: unknown): ActaItem[] => {
  let candidates = value;
  if (typeof value === 'string') {
    try {
      candidates = JSON.parse(value);
    } catch {
      candidates = [];
    }
  }
  const parsed = Array.isArray(candidates)
    ? candidates.map((item) => parseActaItem(item)).filter((item): item is ActaItem => Boolean(item))
    : [];
  if (parsed.length > 0) return parsed;
  const legacyItem = parseActaItem(fallback);
  return legacyItem ? [legacyItem] : [];
};

const getCloudEvidenceUrls = async (photo: InspectionPhoto): Promise<string[]> => {
  const evidence = normalizeEvidenceTimeline(photo).map((entry) => entry.url);
  return uploadEvidenceToSupabase(photo.id, evidence);
};

export interface SupabaseConnectionStatus {
  connected: boolean;
  configured: boolean;
  message: string;
  missingTables?: string[];
  existingTables?: string[];
}

export type SupabaseSaveResult =
  | { success: true }
  | { success: false; stage: 'configuration' | 'storage' | 'database'; message: string };

export const supabaseService = {
  isConfigured: () => isSupabaseConfigured(),
  getConfig: () => getActiveSupabaseConfig(),

  getUserAccess: async (profile: Pick<InspectorProfile, 'id' | 'email' | 'name'>): Promise<UserAccess> => {
    const fallback = createFallbackAccess(profile);
    if (isPrimaryAdmin(profile.email) || !isSupabaseConfigured()) return fallback;

    const client = getSupabaseClient();
    if (!client) return fallback;

    try {
      const { data, error } = await client
        .from('profiles')
        .select('id, name, email, role, allowed_modules, email_confirmed_at')
        .eq('id', profile.id)
        .maybeSingle();

      if (error || !data) return fallback;
      const role: AppRole = data.role === 'admin' ? 'admin' : 'inspector';
      return {
        id: data.id,
        name: data.name || profile.name,
        email: data.email || profile.email,
        role,
        allowedModules: role === 'admin' ? [...ALL_OPERATIONAL_MODULES] : normalizeModules(data.allowed_modules),
        emailConfirmedAt: data.email_confirmed_at || null,
      };
    } catch {
      return fallback;
    }
  },

  listUserAccess: async (): Promise<UserAccess[] | null> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) return null;

    const { data, error } = await client
      .from('profiles')
      .select('id, name, email, role, allowed_modules, email_confirmed_at')
      .order('name', { ascending: true });

    if (error || !data) return null;
    return data.map((user) => {
      const role: AppRole = isPrimaryAdmin(user.email) || user.role === 'admin' ? 'admin' : 'inspector';
      return {
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        role,
        allowedModules: role === 'admin' ? [...ALL_OPERATIONAL_MODULES] : normalizeModules(user.allowed_modules),
        emailConfirmedAt: user.email_confirmed_at || null,
      };
    });
  },

  updateUserAccess: async (userId: string, role: AppRole, allowedModules: AppModule[]): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) return false;

    const accessModules = role === 'admin' ? ALL_OPERATIONAL_MODULES : normalizeModules(allowedModules);
    const { error } = await client
      .from('profiles')
      .update({ role, allowed_modules: accessModules, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  },

  // Test connection to Supabase and check if tables exist
  testConnection: async (): Promise<SupabaseConnectionStatus> => {
    if (!isSupabaseConfigured()) {
      return {
        connected: false,
        configured: false,
        message: 'Falta configurar la URL y la Anon Key de Supabase.',
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return {
        connected: false,
        configured: true,
        message: 'No se pudo inicializar el cliente de Supabase.',
      };
    }

    const tablesToCheck = [
      'inspection_photos',
      'profiles',
      'inspection_activities',
      'inspection_collections',
      'app_settings',
    ];

    const missingTables: string[] = [];
    const existingTables: string[] = [];

    for (const table of tablesToCheck) {
      try {
        const { error } = await client.from(table).select('id').limit(1);
        if (error) {
          // If error code is 42P01 (relation does not exist) or similar table missing error
          if (
            error.code === '42P01' ||
            error.code === 'PGRST205' ||
            /does not exist|relation|could not find the table|schema cache/i.test(error.message || '')
          ) {
            missingTables.push(table);
          } else if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
            return {
              connected: false,
              configured: true,
              message: 'Error de autenticación: Anon Key inválida o expirada.',
            };
          } else {
            // Table exists but maybe empty or RLS prevented rows, treat as existing
            existingTables.push(table);
          }
        } else {
          existingTables.push(table);
        }
      } catch (err: any) {
        missingTables.push(table);
      }
    }

    if (missingTables.length === 0) {
      return {
        connected: true,
        configured: true,
        message: '¡Conexión exitosa! Todas las tablas de inspección existen en Supabase.',
        existingTables,
        missingTables: [],
      };
    } else if (existingTables.length > 0) {
      return {
        connected: true,
        configured: true,
        message: `Conexión establecida. Faltan ${missingTables.length} tablas por crear: ${missingTables.join(', ')}.`,
        existingTables,
        missingTables,
      };
    } else {
      return {
        connected: true,
        configured: true,
        message: 'Conexión a Supabase establecida, pero las tablas aún no han sido creadas. Ejecuta el script SQL en el editor de Supabase.',
        existingTables: [],
        missingTables,
      };
    }
  },

  // Auth: Get current session/user
  getCurrentUser: async () => {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      const { data } = await client.auth.getUser();
      return data.user || null;
    } catch (err) {
      console.warn('Error fetching Supabase user:', err);
      return null;
    }
  },

  // Auth: Sign Out
  signOut: async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Error signing out from Supabase:', err);
      }
    }
  },

  // Photos: Save or sync photo to Supabase
  savePhoto: async (photo: InspectionPhoto, userId?: string): Promise<SupabaseSaveResult> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return {
        success: false,
        stage: 'configuration',
        message: 'No hay una conexión válida con Supabase. Verifica la URL y la clave pública.',
      };
    }

    try {
      let cloudEvidenceUrls: string[];
      try {
        cloudEvidenceUrls = await getCloudEvidenceUrls(photo);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudieron cargar las evidencias.';
        console.warn('Supabase Storage upload error:', message);
        return { success: false, stage: 'storage', message };
      }
      const cloudImageUrl = cloudEvidenceUrls[0] || (photo.imageUrl.startsWith('data:image/') ? '' : photo.imageUrl);
      const row = serializePhotoToSupabaseRow(photo, cloudImageUrl, cloudEvidenceUrls, userId);
      let { error } = await client.from('inspection_photos').upsert(row);

      // Si las columnas progress_percentage o linear_meters aún no existen en Supabase, reintentar sin ellas
      if (error && (error.code === '42703' || error.message.includes('progress_percentage') || error.message.includes('linear_meters') || error.message.includes('PGRST204'))) {
        const fallbackRow = { ...row };
        delete (fallbackRow as any).progress_percentage;
        delete (fallbackRow as any).linear_meters;
        const retryRes = await client.from('inspection_photos').upsert(fallbackRow);
        error = retryRes.error;
      }

      if (error) {
        console.warn('Supabase upsert note:', error.message);
        return { success: false, stage: 'database', message: error.message };
      }
      return { success: true };
    } catch (err) {
      console.warn('Error saving to Supabase:', err);
      return {
        success: false,
        stage: 'database',
        message: err instanceof Error ? err.message : 'No se pudo actualizar el registro de inspección.',
      };
    }
  },

  // Photos: Bulk sync multiple photos to Supabase
  bulkSyncPhotos: async (photos: InspectionPhoto[], userId?: string): Promise<{ success: number; failed: number }> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured() || photos.length === 0) {
      return { success: 0, failed: photos.length };
    }

    try {
      const cloudEvidenceByPhoto = await Promise.all(photos.map((photo) => getCloudEvidenceUrls(photo)));
      const records = photos.map((photo, index) => {
        const cloudEvidenceUrls = cloudEvidenceByPhoto[index] || [];
        const cloudImageUrl = cloudEvidenceUrls[0] || (photo.imageUrl.startsWith('data:image/') ? '' : photo.imageUrl);
        return serializePhotoToSupabaseRow(photo, cloudImageUrl, cloudEvidenceUrls, userId);
      });

      let { error } = await client.from('inspection_photos').upsert(records);
      if (error && (error.code === '42703' || error.message.includes('progress_percentage') || error.message.includes('linear_meters') || error.message.includes('PGRST204'))) {
        const fallbackRecords = records.map((r) => {
          const clone = { ...r };
          delete (clone as any).progress_percentage;
          delete (clone as any).linear_meters;
          return clone;
        });
        const retryRes = await client.from('inspection_photos').upsert(fallbackRecords);
        error = retryRes.error;
      }
      if (error) {
        console.warn('Error in bulkSyncPhotos:', error.message);
        return { success: 0, failed: photos.length };
      }
      return { success: photos.length, failed: 0 };
    } catch (err) {
      console.warn('Bulk sync error:', err);
      return { success: 0, failed: photos.length };
    }
  },

  // Updates sector and sector_code columns in all records across Supabase tables
  updateAllSectorsInSupabase: async (): Promise<{
    success: boolean;
    updatedPhotosCount: number;
    updatedActivitiesCount: number;
    message: string;
  }> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return {
        success: false,
        updatedPhotosCount: 0,
        updatedActivitiesCount: 0,
        message: 'Supabase no está configurado o no se pudo inicializar.',
      };
    }

    try {
      // 1. Update inspection_photos
      const { data: photos, error: photosError } = await client
        .from('inspection_photos')
        .select('id, name');

      let updatedPhotosCount = 0;
      if (photosError) {
        console.warn('Error fetching photos to update sectors:', photosError.message);
      } else if (Array.isArray(photos) && photos.length > 0) {
        // Group by sector/sector_code or update each row
        const updates = photos.map(async (row) => {
          const s = getElementSector(row.name);
          const { error: updErr } = await client
            .from('inspection_photos')
            .update({
              sector: s.label,
              sector_code: s.code,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          if (!updErr) updatedPhotosCount++;
        });
        await Promise.all(updates);
      }

      // 2. Update inspection_activities (if table and records exist)
      let updatedActivitiesCount = 0;
      try {
        const { data: activities, error: actError } = await client
          .from('inspection_activities')
          .select('id, photo_name');

        if (!actError && Array.isArray(activities) && activities.length > 0) {
          const actUpdates = activities.map(async (row) => {
            const s = getElementSector(row.photo_name);
            const { error: updActErr } = await client
              .from('inspection_activities')
              .update({
                sector: s.label,
                sector_code: s.code,
              })
              .eq('id', row.id);
            if (!updActErr) updatedActivitiesCount++;
          });
          await Promise.all(actUpdates);
        }
      } catch (e) {
        // Table or columns might not exist yet
      }

      return {
        success: true,
        updatedPhotosCount,
        updatedActivitiesCount,
        message: `Se actualizaron correctamente ${updatedPhotosCount} elementos en la columna sector de Supabase.`,
      };
    } catch (err: any) {
      console.error('Error updating sectors in Supabase:', err);
      return {
        success: false,
        updatedPhotosCount: 0,
        updatedActivitiesCount: 0,
        message: err.message || 'Error inesperado al actualizar sectores en Supabase.',
      };
    }
  },

  // Photos: Fetch all inspection photos from Supabase
  fetchPhotos: async (): Promise<InspectionPhoto[] | null> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await client
        .from('inspection_photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching photos from Supabase:', error.message);
        return null;
      }

      if (!data) return [];

      return data.map((item: any) => {
        const evidenceTimeline = parseEvidenceTimeline(item.image_urls, item.image_url, item.date_raw || item.created_at);
        const imageUrls = evidenceTimeline.map((entry) => entry.url);
        const elementType = isElementType(item.element_type)
          ? item.element_type
          : getElementType({
            cameraCode: item.camera_code || undefined,
            tramo: item.tramo || undefined,
            metraje: item.metraje || undefined,
            electricalType: item.electrical_type || undefined,
            planArea: item.plan_area || undefined,
          });
        const parsedConduits = parsePipeConduits(item.pipe_conduits);
        const resolvedPipeNetworkType: PipeNetworkType = ['media_tension', 'baja_tension', 'datos'].includes(item.pipe_network_type)
          ? item.pipe_network_type
          : (parsedConduits[0]?.networkType || (
              item.camera_type === 'MT' ? 'media_tension' :
              item.camera_type === 'Datos' || (item.camera_type || '').toUpperCase() === 'DATOS' ? 'datos' :
              item.camera_type === 'BT' ? 'baja_tension' :
              (item.name || '').toLowerCase().includes('dato') || (item.field_notes || '').toLowerCase().includes('dato') ? 'datos' :
              (item.name || '').toLowerCase().includes('baja') || (item.field_notes || '').toLowerCase().includes('baja') ? 'baja_tension' :
              'media_tension'
            ));

        const finalPipeConduits = elementType === 'tuberia'
          ? (parsedConduits.length > 0
              ? parsedConduits
              : [{
                  id: `conduit-${item.id}`,
                  networkType: resolvedPipeNetworkType,
                  configuration: item.tramo || '',
                  meters: item.metraje !== undefined ? Number(item.metraje) : 0,
                }])
          : undefined;

        const resolvedCameraType = elementType === 'camara'
          ? (item.camera_type || 'MT')
          : undefined;

        const sectorInfo = getElementSector(item.name);

        const decodedNotes = decodeProgressFromFieldNotes(item.field_notes);
        const localProgress = getElementProgress(item.id);
        const resolvedProgress =
          typeof item.progress_percentage === 'number' && !Number.isNaN(item.progress_percentage)
            ? Math.max(0, Math.min(100, Math.round(item.progress_percentage)))
            : localProgress !== undefined
              ? localProgress
              : decodedNotes.progress !== undefined
                ? decodedNotes.progress
                : item.execution_status === 'Terminado'
                  ? 100
                  : item.execution_status === 'No iniciado'
                    ? 0
                    : 50;

        // Persistir en caché local inmediatamente para que nunca se pierda al recargar
        saveElementProgress(item.id, resolvedProgress);

        return {
        id: item.id,
        displayId: item.display_id || item.id,
        name: item.name || 'Sin título',
        sector: item.sector || sectorInfo.label,
        sectorCode: item.sector_code || sectorInfo.code,
        imageUrl: imageUrls[0] || item.image_url,
        imageUrls,
        evidenceTimeline,
        date: item.date,
        dateRaw: item.date_raw || item.created_at || new Date().toISOString(),
        status: item.status || 'Synced',
        executionStatus: item.execution_status || 'En proceso',
        category: item.category || 'inspection',
        categoryLabel: item.category_label || 'Inspección',
        location: item.location || 'Bodega 1',
        elementType,
        cameraCode: elementType === 'camara' ? item.camera_code || 'SB850' : undefined,
        cameraType: resolvedCameraType,
        acta: item.acta || undefined,
        actaItem: parseActaItems(item.acta_item)[0],
        actaItems: parseActaItems(item.acta_item),
        showActaLabel: item.show_acta_label !== false,
        actaLabelPosition: ['arriba', 'abajo', 'izquierda', 'derecha'].includes(item.acta_label_position)
          ? item.acta_label_position
          : 'derecha',
        tramo: item.tramo || undefined,
        metraje: item.metraje || undefined,
        pipeNetworkType: elementType === 'tuberia' ? resolvedPipeNetworkType : undefined,
        pipeColor: typeof item.pipe_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.pipe_color)
          ? item.pipe_color
          : (elementType === 'tuberia' ? getPipeNetworkOption(resolvedPipeNetworkType).color : undefined),
        pipeConduits: finalPipeConduits,
        planArea: item.cable_type === 'alumbrado' || item.electrical_type === 'poste_alumbrado' || item.plan_area === 'electrical_lighting'
          ? 'electrical_lighting'
          : item.plan_area === 'electrical_mt' || item.plan_area === 'electrical_bt'
            ? item.plan_area
            : item.plan_area === 'electrical' ? 'electrical_mt' : 'civil',
        electricalType: [
          'transformador', 'tablero_baja_tension', 'tablero_distribucion', 'barrajes_elastomericos',
          'malla_tierra', 'poste_media_tension', 'poste_alumbrado', 'reconectador', 'cableado',
        ].includes(item.electrical_type) ? item.electrical_type : undefined,
        electricalColor: typeof item.electrical_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.electrical_color)
          ? item.electrical_color
          : undefined,
        cableType: ['media_tension', 'baja_tension', 'alumbrado'].includes(item.cable_type)
          ? item.cable_type
          : undefined,
        cableGauge: ['12', '10', '8', '6', '4', '2', '1/0', '2/0', '3/0', '4/0', '250', '350', '500'].includes(item.cable_gauge)
          ? item.cable_gauge
          : undefined,
        cableMeters: item.cable_meters || undefined,
        inspectorName: item.inspector_name || 'Inspector',
        inspectorId: item.inspector_id || '8842',
        inspectorAvatar: item.inspector_avatar || '',
        type: item.type || 'Fotografía',
        verified: Boolean(item.verified),
        fieldNotes: decodedNotes.cleanFieldNotes,
        progressPercentage: resolvedProgress,
        requiresImmediateAction: Boolean(item.requires_immediate_action),
        fileSize: item.file_size || '1.4 MB',
        resolution: item.resolution || '1920x1080',
        planX: typeof item.plan_x === 'number' ? item.plan_x : undefined,
        planY: typeof item.plan_y === 'number' ? item.plan_y : undefined,
        planEndX: typeof item.plan_end_x === 'number' ? item.plan_end_x : undefined,
        planEndY: typeof item.plan_end_y === 'number' ? item.plan_end_y : undefined,
        };
      });
    } catch (err) {
      console.warn('Error in fetchPhotos:', err);
      return null;
    }
  },

  // Photos: Delete photo from Supabase
  deletePhoto: async (photoId: string): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return false;
    }

    try {
      const { error } = await client.from('inspection_photos').delete().eq('id', photoId);
      if (error) {
        console.warn('Error deleting photo from Supabase:', error.message);
        return false;
      }
      await removeEvidenceFromSupabase(photoId);
      return true;
    } catch (err) {
      console.warn('Error in deletePhoto:', err);
      return false;
    }
  },

  // Administrative reset: clears operational inspection data only. Profiles, roles and app access are intentionally excluded.
  resetOperationalData: async (): Promise<{ success: boolean; remote: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return { success: true, remote: false };
    }

    try {
      const { error } = await client.rpc('reset_inspection_data');
      if (error) {
        console.warn('Error resetting operational data in Supabase:', error.message);
        const wasBlockedForUnfilteredDelete =
          error.code === '21000' && /DELETE requires a WHERE clause/i.test(error.message);
        return {
          success: false,
          remote: true,
          error: wasBlockedForUnfilteredDelete
            ? 'Supabase bloqueó el restablecimiento porque la función instalada aún usa eliminaciones sin condición. No se eliminaron datos. Actualiza el Script SQL de Supabase y vuelve a intentarlo.'
            : error.message,
        };
      }
      return { success: true, remote: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo restablecer la base de datos.';
      console.warn('Operational reset error:', message);
      return { success: false, remote: true, error: message };
    }
  },

  // Profile: Sync Inspector Profile
  syncProfile: async (profile: InspectorProfile, userId?: string): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return false;
    }

    try {
      const record: Record<string, unknown> = {
        id: userId || profile.id,
        name: profile.name,
        email: profile.email,
        terminal: profile.terminal,
        department: profile.department,
        avatar_url: profile.avatarUrl,
        phone: profile.phone,
        updated_at: new Date().toISOString(),
      };

      if (isPrimaryAdmin(profile.email)) {
        record.role = 'admin';
        record.allowed_modules = ALL_OPERATIONAL_MODULES;
      }

      const { error } = await client.from('profiles').upsert(record);

      if (error) {
        console.warn('Supabase profile sync note:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Error syncing profile to Supabase:', err);
      return false;
    }
  },

  // Activity: Log activity
  logActivity: async (activity: ActivityItem, userId?: string): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return false;
    }

    try {
      const sectorInfo = getElementSector(activity.photoName);
      const activityRow = {
        id: activity.id,
        timestamp: activity.timestamp,
        action: activity.action,
        photo_name: activity.photoName,
        photo_id: activity.photoId,
        user_name: activity.user,
        type: activity.type,
        user_id: userId,
        sector: sectorInfo.label,
        sector_code: sectorInfo.code,
        progress_percentage: getElementProgress(activity.photoId) ?? null,
        created_at: new Date().toISOString(),
      };

      let { error } = await client.from('inspection_activities').upsert(activityRow);

      if (error && (error.code === '42703' || error.message.includes('progress_percentage') || error.message.includes('sector') || error.message.includes('PGRST204'))) {
        const fallback = { ...activityRow };
        delete (fallback as any).progress_percentage;
        delete (fallback as any).sector;
        delete (fallback as any).sector_code;
        const retry = await client.from('inspection_activities').upsert(fallback);
        error = retry.error;
      }

      if (error) {
        console.warn('Error logging activity to Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Error in logActivity:', err);
      return false;
    }
  },

  // Activity: Fetch activities
  fetchActivities: async (): Promise<ActivityItem[] | null> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await client
        .from('inspection_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return null;

      return data.map((item: any) => ({
        id: item.id,
        timestamp: item.timestamp,
        action: item.action,
        photoName: item.photo_name,
        photoId: item.photo_id,
        user: item.user_name,
        type: item.type,
      }));
    } catch (err) {
      console.warn('Error fetching activities:', err);
      return null;
    }
  },

  // Collections: Save collection
  saveCollection: async (collection: InspectionCollection, userId?: string): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return false;
    }

    try {
      const { error } = await client.from('inspection_collections').upsert({
        id: collection.id,
        title: collection.title,
        description: collection.description,
        item_count: collection.itemCount,
        cover_image: collection.coverImage,
        category: collection.category,
        last_updated: collection.lastUpdated,
        photo_ids: collection.photoIds,
        user_id: userId,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('Error saving collection:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Error in saveCollection:', err);
      return false;
    }
  },

  // Returns the complete SQL creation script for Supabase SQL Editor
  getSupabaseSchemaSql: (): string => {
    return `-- ============================================================
-- SCHEMA DE BASE DE DATOS EN SUPABASE (POSTGRESQL) PARA PHOTOVAULT PRO
-- Contiene las tablas con la información de los registros agregados por el inspector
-- ============================================================

-- 1. TABLA DE PERFILES DE INSPECTORES (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'inspector' CHECK (role IN ('admin', 'inspector')),
  allowed_modules JSONB NOT NULL DEFAULT '["dashboard", "map", "upload", "history"]'::jsonb,
  terminal TEXT DEFAULT 'Terminal A-12',
  department TEXT DEFAULT 'Garantía Estructural y Calidad',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migración segura para proyectos creados con versiones anteriores.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_modules JSONB NOT NULL DEFAULT '["dashboard", "map", "upload", "history"]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'inspector';
UPDATE public.profiles
SET role = 'admin', allowed_modules = '["dashboard", "map", "database", "upload", "history", "activity", "settings"]'::jsonb
WHERE lower(email) = 'jheanmurillo73@gmail.com';
UPDATE public.profiles SET role = 'inspector' WHERE role IS NULL OR role NOT IN ('admin', 'inspector');
UPDATE public.profiles p
SET email_confirmed_at = u.email_confirmed_at
FROM auth.users u
WHERE p.id = u.id::text
  AND p.email_confirmed_at IS DISTINCT FROM u.email_confirmed_at;

-- 2. TABLA PRINCIPAL DE FOTOS Y REGISTROS DE INSPECCIÓN (inspection_photos)
CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_urls TEXT,
  date TEXT NOT NULL,
  date_raw TEXT,
  status TEXT NOT NULL DEFAULT 'Synced' CHECK (status IN ('Synced', 'In Progress', 'Flagged')),
  execution_status TEXT NOT NULL DEFAULT 'No iniciado' CHECK (execution_status IN ('No iniciado', 'En proceso', 'Terminado')),
  progress_percentage NUMERIC DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  linear_meters NUMERIC DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'inspection',
  category_label TEXT NOT NULL DEFAULT 'Inspección General',
  location TEXT NOT NULL DEFAULT 'Bodega 1',
  element_type TEXT NOT NULL DEFAULT 'caja' CHECK (element_type IN ('caja', 'camara', 'tuberia', 'electrico')),
  camera_code TEXT DEFAULT 'SB850',
  camera_type TEXT DEFAULT 'MT',
  acta TEXT,
  acta_item JSONB,
  show_acta_label BOOLEAN NOT NULL DEFAULT true,
  acta_label_position TEXT NOT NULL DEFAULT 'derecha' CHECK (acta_label_position IN ('arriba', 'abajo', 'izquierda', 'derecha')),
  tramo TEXT,
  metraje TEXT,
  pipe_network_type TEXT CHECK (pipe_network_type IS NULL OR pipe_network_type IN ('media_tension', 'baja_tension', 'datos')),
  pipe_color TEXT CHECK (pipe_color IS NULL OR pipe_color ~ '^#[0-9A-Fa-f]{6}$'),
  pipe_conduits JSONB NOT NULL DEFAULT '[]'::jsonb,
  plan_area TEXT NOT NULL DEFAULT 'civil' CHECK (plan_area IN ('civil', 'electrical', 'electrical_mt', 'electrical_bt', 'electrical_lighting')),
  electrical_type TEXT,
  electrical_color TEXT CHECK (electrical_color IS NULL OR electrical_color ~ '^#[0-9A-Fa-f]{6}$'),
  cable_type TEXT CHECK (cable_type IS NULL OR cable_type IN ('media_tension', 'baja_tension', 'alumbrado')),
  cable_gauge TEXT CHECK (cable_gauge IS NULL OR cable_gauge IN ('12', '10', '8', '6', '4', '2', '1/0', '2/0', '3/0', '4/0', '250', '350', '500')),
  cable_meters TEXT,
  inspector_name TEXT NOT NULL,
  inspector_id TEXT NOT NULL,
  inspector_avatar TEXT DEFAULT '',
  type TEXT DEFAULT 'Fotografía de Campo',
  verified BOOLEAN NOT NULL DEFAULT false,
  field_notes TEXT DEFAULT '',
  requires_immediate_action BOOLEAN NOT NULL DEFAULT false,
  file_size TEXT DEFAULT '1.4 MB',
  resolution TEXT DEFAULT '1920x1080',
  plan_x NUMERIC CHECK (plan_x >= 0 AND plan_x <= 100),
  plan_y NUMERIC CHECK (plan_y >= 0 AND plan_y <= 100),
  plan_end_x NUMERIC CHECK (plan_end_x >= 0 AND plan_end_x <= 100),
  plan_end_y NUMERIC CHECK (plan_end_y >= 0 AND plan_end_y <= 100),
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC DEFAULT 0;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS linear_meters NUMERIC DEFAULT 0;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS plan_x NUMERIC CHECK (plan_x >= 0 AND plan_x <= 100);
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS plan_y NUMERIC CHECK (plan_y >= 0 AND plan_y <= 100);
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS plan_end_x NUMERIC CHECK (plan_end_x >= 0 AND plan_end_x <= 100);
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS plan_end_y NUMERIC CHECK (plan_end_y >= 0 AND plan_end_y <= 100);
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS acta TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS acta_item JSONB;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS image_urls TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS show_acta_label BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS acta_label_position TEXT NOT NULL DEFAULT 'derecha' CHECK (acta_label_position IN ('arriba', 'abajo', 'izquierda', 'derecha'));
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS pipe_network_type TEXT CHECK (pipe_network_type IS NULL OR pipe_network_type IN ('media_tension', 'baja_tension', 'datos'));
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS pipe_color TEXT CHECK (pipe_color IS NULL OR pipe_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS pipe_conduits JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS cable_type TEXT CHECK (cable_type IS NULL OR cable_type IN ('media_tension', 'baja_tension', 'alumbrado'));
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS cable_gauge TEXT CHECK (cable_gauge IS NULL OR cable_gauge IN ('12', '10', '8', '6', '4', '2', '1/0', '2/0', '3/0', '4/0', '250', '350', '500'));
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS cable_meters TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS plan_area TEXT NOT NULL DEFAULT 'civil';
UPDATE public.inspection_photos SET plan_area = 'electrical_mt' WHERE plan_area = 'electrical';
ALTER TABLE public.inspection_photos DROP CONSTRAINT IF EXISTS inspection_photos_plan_area_check;
ALTER TABLE public.inspection_photos ADD CONSTRAINT inspection_photos_plan_area_check CHECK (plan_area IN ('civil', 'electrical_mt', 'electrical_bt', 'electrical_lighting'));
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS electrical_type TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS electrical_color TEXT CHECK (electrical_color IS NULL OR electrical_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS element_type TEXT;
UPDATE public.inspection_photos
SET element_type = CASE
  WHEN electrical_type IS NOT NULL THEN 'electrico'
  WHEN tramo IS NOT NULL OR metraje IS NOT NULL THEN 'tuberia'
  WHEN camera_code IS NOT NULL THEN 'camara'
  ELSE 'camara'
END
WHERE element_type IS NULL;
UPDATE public.inspection_photos
SET element_type = 'camara',
    camera_code = COALESCE(NULLIF(camera_code, ''), 'SB850'),
    camera_type = COALESCE(NULLIF(camera_type, ''), 'MT')
WHERE element_type = 'caja';
ALTER TABLE public.inspection_photos ALTER COLUMN element_type SET DEFAULT 'caja';
ALTER TABLE public.inspection_photos ALTER COLUMN element_type SET NOT NULL;
ALTER TABLE public.inspection_photos DROP CONSTRAINT IF EXISTS inspection_photos_element_type_check;
ALTER TABLE public.inspection_photos ADD CONSTRAINT inspection_photos_element_type_check CHECK (element_type IN ('caja', 'camara', 'tuberia', 'electrico'));

-- Columnas auxiliares para visualización directa en Supabase Table Editor
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS has_media_tension BOOLEAN DEFAULT false;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS has_baja_tension BOOLEAN DEFAULT false;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS has_datos BOOLEAN DEFAULT false;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS tramo_mt TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS tramo_bt TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS tramo_datos TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS redes_list TEXT;

-- Columnas de sector para cámaras y tramos de tubería
-- Regla exacta:
-- - Contiene 'I1' en su nombre -> Intersección 1 ('I1')
-- - Contiene 'I2' en su nombre -> Intersección 2 ('I2')
-- - Contiene 'TRONCAL' en su nombre -> Troncal Principal / Área Troncal ('TRONCAL')
-- - Resto -> Otros Sectores ('OTRO')
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS sector_code TEXT;

-- Sincronizar porcentajes de avance iniciales si son nulos
UPDATE public.inspection_photos
SET progress_percentage = CASE
  WHEN execution_status = 'Terminado' THEN 100
  WHEN execution_status = 'No iniciado' THEN 0
  ELSE 50
END
WHERE progress_percentage IS NULL;

-- Sincronizar metros lineales reales iniciales (Multiplicador x Distancia)
UPDATE public.inspection_photos
SET linear_meters = CASE
  WHEN element_type = 'tuberia' OR tramo IS NOT NULL THEN
    ROUND(
      COALESCE(NULLIF(SUBSTRING(TRIM(tramo) FROM '^([0-9]+)\s*[xX*]'), '')::numeric, 1) *
      COALESCE(NULLIF(metraje, '')::numeric, 0),
      2
    )
  ELSE 0
END
WHERE linear_meters IS NULL OR linear_meters = 0;

-- Sincronizar columnas auxiliares, redes y sectores
UPDATE public.inspection_photos
SET
  sector_code = CASE
    WHEN UPPER(name) LIKE '%I1%' THEN 'I1'
    WHEN UPPER(name) LIKE '%I2%' THEN 'I2'
    WHEN UPPER(name) LIKE '%TRONCAL%' THEN 'TRONCAL'
    ELSE 'OTRO'
  END,
  sector = CASE
    WHEN UPPER(name) LIKE '%I1%' THEN 'Intersección 1'
    WHEN UPPER(name) LIKE '%I2%' THEN 'Intersección 2'
    WHEN UPPER(name) LIKE '%TRONCAL%' THEN 'Troncal Principal'
    ELSE 'Otros Sectores'
  END,
  camera_type = CASE WHEN element_type = 'tuberia' THEN NULL ELSE camera_type END,
  has_media_tension = (pipe_conduits::text ILIKE '%media_tension%' OR pipe_network_type = 'media_tension'),
  has_baja_tension = (pipe_conduits::text ILIKE '%baja_tension%' OR pipe_network_type = 'baja_tension'),
  has_datos = (pipe_conduits::text ILIKE '%datos%' OR pipe_network_type = 'datos' OR lower(name) LIKE '%dato%'),
  redes_list = TRIM(BOTH ', ' FROM CONCAT(
    CASE WHEN pipe_conduits::text ILIKE '%media_tension%' OR pipe_network_type = 'media_tension' THEN 'MT, ' ELSE '' END,
    CASE WHEN pipe_conduits::text ILIKE '%baja_tension%' OR pipe_network_type = 'baja_tension' THEN 'BT, ' ELSE '' END,
    CASE WHEN pipe_conduits::text ILIKE '%datos%' OR pipe_network_type = 'datos' OR lower(name) LIKE '%dato%' THEN 'DATOS' ELSE '' END
  ));

-- ============================================================
-- VISTAS DE TRAMOS Y CANALIZACIONES DESGLOSADAS (MT, BT y DATOS)
-- Incluyen multiplicador de tramo, distancia y metros lineales reales (multiplicador * distancia)
-- ============================================================

DROP VIEW IF EXISTS public.v_tramos_redes CASCADE;
DROP VIEW IF EXISTS public.v_tramos_datos CASCADE;
DROP VIEW IF EXISTS public.v_tramos_media_tension CASCADE;
DROP VIEW IF EXISTS public.v_tramos_baja_tension CASCADE;
DROP VIEW IF EXISTS public.v_resumen_redes CASCADE;
DROP VIEW IF EXISTS public.v_resumen_tramos_interseccion CASCADE;
DROP VIEW IF EXISTS public.v_tramos_conduits CASCADE;

CREATE OR REPLACE VIEW public.v_tramos_conduits AS
SELECT
  p.id AS photo_id,
  p.display_id,
  p.name AS tramo_nombre,
  CASE
    WHEN UPPER(p.name) LIKE '%I1%' THEN 'I1'
    WHEN UPPER(p.name) LIKE '%I2%' THEN 'I2'
    WHEN UPPER(p.name) LIKE '%TRONCAL%' THEN 'TRONCAL'
    ELSE 'OTRO'
  END AS sector_codigo,
  CASE
    WHEN UPPER(p.name) LIKE '%I1%' THEN 'Intersección 1'
    WHEN UPPER(p.name) LIKE '%I2%' THEN 'Intersección 2'
    WHEN UPPER(p.name) LIKE '%TRONCAL%' THEN 'Troncal Principal'
    ELSE 'Otros Sectores'
  END AS sector_nombre,
  c.id AS conduit_id,
  c."networkType" AS red_codigo,
  CASE
    WHEN c."networkType" = 'media_tension' THEN 'Media Tensión (MT)'
    WHEN c."networkType" = 'baja_tension' THEN 'Baja Tensión (BT)'
    WHEN c."networkType" = 'datos' THEN 'Datos / Control'
    ELSE COALESCE(c."networkType", 'Media Tensión (MT)')
  END AS red_label,
  c.configuration AS diametro_configuracion,
  COALESCE(
    NULLIF(SUBSTRING(TRIM(c.configuration) FROM '^([0-9]+)\s*[xX*]'), '')::numeric,
    1
  ) AS multiplicador_tramo,
  COALESCE(NULLIF(c.meters, '')::numeric, NULLIF(p.metraje, '')::numeric, 0) AS distancia_metros,
  ROUND(
    (COALESCE(NULLIF(SUBSTRING(TRIM(c.configuration) FROM '^([0-9]+)\s*[xX*]'), '')::numeric, 1) *
     COALESCE(NULLIF(c.meters, '')::numeric, NULLIF(p.metraje, '')::numeric, 0))::numeric,
    2
  ) AS metros_lineales_reales,
  COALESCE(NULLIF(c.meters, '')::numeric, NULLIF(p.metraje, '')::numeric, 0) AS metraje_metros,
  COALESCE(
    p.progress_percentage,
    CASE
      WHEN p.execution_status = 'Terminado' THEN 100
      WHEN p.execution_status = 'No iniciado' THEN 0
      ELSE 50
    END
  ) AS porcentaje_avance,
  p.execution_status,
  p.acta,
  p.location,
  p.inspector_name,
  p.date,
  p.created_at
FROM public.inspection_photos p,
LATERAL jsonb_to_recordset(
  CASE
    WHEN jsonb_typeof(p.pipe_conduits) = 'array' AND jsonb_array_length(p.pipe_conduits) > 0
    THEN p.pipe_conduits
    ELSE jsonb_build_array(jsonb_build_object(
      'id', 'c-' || p.id,
      'networkType', COALESCE(p.pipe_network_type, 'media_tension'),
      'configuration', COALESCE(p.tramo, 'Sin medida'),
      'meters', COALESCE(p.metraje, '0')
    ))
  END
) AS c("id" text, "networkType" text, "configuration" text, "meters" text)
WHERE p.element_type = 'tuberia' OR p.tramo IS NOT NULL;

-- Vista unificada de compatibilidad v_tramos_redes
CREATE OR REPLACE VIEW public.v_tramos_redes AS
SELECT * FROM public.v_tramos_conduits;

-- Vista exclusiva de Tramos y Ductos de DATOS
CREATE OR REPLACE VIEW public.v_tramos_datos AS
SELECT * FROM public.v_tramos_conduits
WHERE red_codigo = 'datos';

-- Vista exclusiva de Tramos y Ductos de MEDIA TENSIÓN
CREATE OR REPLACE VIEW public.v_tramos_media_tension AS
SELECT * FROM public.v_tramos_conduits
WHERE red_codigo = 'media_tension';

-- Vista exclusiva de Tramos y Ductos de BAJA TENSIÓN
CREATE OR REPLACE VIEW public.v_tramos_baja_tension AS
SELECT * FROM public.v_tramos_conduits
WHERE red_codigo = 'baja_tension';

-- Vista analítica de Resumen de Metrados por Red
CREATE OR REPLACE VIEW public.v_resumen_redes AS
SELECT
  red_label,
  red_codigo,
  COUNT(*) AS total_ductos,
  ROUND(SUM(distancia_metros)::numeric, 2) AS distancia_trazas_metros,
  ROUND(SUM(metros_lineales_reales)::numeric, 2) AS total_metros_lineales_reales,
  ROUND(SUM(metraje_metros)::numeric, 2) AS total_metros,
  ROUND(AVG(porcentaje_avance)::numeric, 1) AS porcentaje_avance_promedio,
  COUNT(DISTINCT photo_id) AS total_tramos_fisicos
FROM public.v_tramos_conduits
GROUP BY red_label, red_codigo
ORDER BY red_label;

-- Vista analítica de Resumen de Tramos de Tubería por Intersección / Sector
CREATE OR REPLACE VIEW public.v_resumen_tramos_interseccion AS
SELECT
  sector_nombre AS sector,
  sector_codigo,
  COUNT(DISTINCT photo_id) AS total_tramos_fisicos,
  COUNT(*) AS total_ductos,
  ROUND(SUM(distancia_metros)::numeric, 2) AS distancia_trazas_metros,
  ROUND(SUM(metros_lineales_reales)::numeric, 2) AS total_metros_lineales_reales,
  ROUND(SUM(metraje_metros)::numeric, 2) AS total_metros_lineales,
  ROUND(SUM(CASE WHEN red_codigo = 'media_tension' THEN metros_lineales_reales ELSE 0 END)::numeric, 2) AS metros_mt_reales,
  ROUND(SUM(CASE WHEN red_codigo = 'baja_tension' THEN metros_lineales_reales ELSE 0 END)::numeric, 2) AS metros_bt_reales,
  ROUND(SUM(CASE WHEN red_codigo = 'datos' THEN metros_lineales_reales ELSE 0 END)::numeric, 2) AS metros_datos_reales,
  ROUND(AVG(porcentaje_avance)::numeric, 1) AS porcentaje_avance_promedio
FROM public.v_tramos_conduits
GROUP BY sector_nombre, sector_codigo
ORDER BY sector_nombre;

-- ============================================================
-- VISTAS RELACIONALES Y RESÚMENES DE CÁMARAS POR INTERSECCIÓN / SECTOR
-- ============================================================

DROP VIEW IF EXISTS public.v_resumen_camaras_interseccion CASCADE;
DROP VIEW IF EXISTS public.v_matriz_camaras_por_sector CASCADE;
DROP VIEW IF EXISTS public.v_camaras_inventario CASCADE;

-- 1. Vista de Inventario Normalizado de Cámaras (con Sector, Red y Porcentaje de Avance)
CREATE OR REPLACE VIEW public.v_camaras_inventario AS
SELECT
  p.id AS photo_id,
  p.display_id,
  p.name AS nombre_completo,
  p.camera_code AS codigo_camara,
  CASE
    WHEN UPPER(p.name) LIKE '%I1%' THEN 'I1'
    WHEN UPPER(p.name) LIKE '%I2%' THEN 'I2'
    WHEN UPPER(p.name) LIKE '%TRONCAL%' THEN 'TRONCAL'
    ELSE 'OTRO'
  END AS sector_codigo,
  CASE
    WHEN UPPER(p.name) LIKE '%I1%' THEN 'Intersección 1'
    WHEN UPPER(p.name) LIKE '%I2%' THEN 'Intersección 2'
    WHEN UPPER(p.name) LIKE '%TRONCAL%' THEN 'Troncal Principal'
    ELSE 'Otros Sectores'
  END AS sector_nombre,
  CASE
    WHEN p.camera_type ILIKE '%dato%' OR p.camera_type = 'D' THEN 'DATOS'
    WHEN p.camera_type = 'BT' THEN 'BT'
    ELSE 'MT'
  END AS tipo_red,
  CASE
    WHEN p.camera_type ILIKE '%dato%' OR p.camera_type = 'D' THEN 'Datos / Control'
    WHEN p.camera_type = 'BT' THEN 'Baja Tensión (BT)'
    ELSE 'Media Tensión (MT)'
  END AS red_label,
  COALESCE(
    p.progress_percentage,
    CASE
      WHEN p.execution_status = 'Terminado' THEN 100
      WHEN p.execution_status = 'No iniciado' THEN 0
      ELSE 50
    END
  ) AS porcentaje_avance,
  COALESCE(NULLIF(p.execution_status, ''), 'No iniciado') AS estado_ejecucion,
  COALESCE(NULLIF(p.acta, ''), 'Sin Acta') AS acta,
  p.date AS fecha_inspeccion,
  p.location AS bodega_ubicacion,
  p.inspector_name,
  p.latitude,
  p.longitude,
  CASE
    WHEN p.image_urls IS NOT NULL AND p.image_urls != '' AND p.image_urls != '[]' THEN true
    ELSE false
  END AS tiene_fotos,
  p.created_at
FROM public.inspection_photos p
WHERE p.element_type = 'camara';

-- 2. Vista de Resumen Multidimensional con Porcentaje de Avance
CREATE OR REPLACE VIEW public.v_resumen_camaras_interseccion AS
WITH camaras_clasificadas AS (
  SELECT
    p.id,
    p.name,
    COALESCE(
      p.sector,
      CASE
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%I1%' THEN 'Intersección 1'
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%I2%' THEN 'Intersección 2'
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%TRONCAL%' THEN 'Troncal Principal'
        ELSE 'Otros Sectores'
      END
    ) AS sector,
    COALESCE(
      p.sector_code,
      CASE
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%I1%' THEN 'I1'
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%I2%' THEN 'I2'
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%TRONCAL%' THEN 'TRONCAL'
        ELSE 'OTRO'
      END
    ) AS sector_codigo,
    CASE
      WHEN p.camera_type ILIKE '%dato%' OR p.camera_type = 'D' THEN 'DATOS'
      WHEN p.camera_type = 'BT' THEN 'BT'
      ELSE 'MT'
    END AS tipo_red,
    COALESCE(
      p.progress_percentage,
      CASE
        WHEN p.execution_status = 'Terminado' THEN 100
        WHEN p.execution_status = 'No iniciado' THEN 0
        ELSE 50
      END
    ) AS porcentaje_avance,
    COALESCE(NULLIF(p.execution_status, ''), 'No iniciado') AS estado_ejecucion,
    COALESCE(NULLIF(p.acta, ''), 'Sin Acta') AS acta,
    COALESCE(NULLIF(p.date, ''), 'Sin Fecha') AS fecha_inspeccion,
    p.image_urls
  FROM public.inspection_photos p
  WHERE p.element_type = 'camara' OR (p.element_type IS NULL AND p.camera_code IS NOT NULL)
)
SELECT
  sector,
  sector_codigo,
  tipo_red,
  estado_ejecucion,
  ROUND(AVG(porcentaje_avance)::numeric, 1) AS porcentaje_avance_promedio,
  acta,
  fecha_inspeccion,
  COUNT(*) AS total_camaras,
  COUNT(CASE WHEN image_urls IS NOT NULL AND image_urls != '' AND image_urls != '[]' THEN 1 END) AS con_fotos,
  COUNT(CASE WHEN image_urls IS NULL OR image_urls = '' OR image_urls = '[]' THEN 1 END) AS pendientes_fotos,
  STRING_AGG(name, ', ' ORDER BY name) AS elementos_nombres
FROM camaras_clasificadas
GROUP BY
  sector,
  sector_codigo,
  tipo_red,
  estado_ejecucion,
  acta,
  fecha_inspeccion
ORDER BY
  sector,
  tipo_red,
  estado_ejecucion;

-- 3. Vista Matriz Ejecutiva por Sector
CREATE OR REPLACE VIEW public.v_matriz_camaras_por_sector AS
WITH camaras_clasificadas AS (
  SELECT
    p.id,
    p.name,
    COALESCE(
      p.sector,
      CASE
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%I1%' THEN 'Intersección 1'
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%I2%' THEN 'Intersección 2'
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%TRONCAL%' THEN 'Troncal Principal'
        ELSE 'Otros Sectores'
      END
    ) AS sector,
    COALESCE(
      p.sector_code,
      CASE
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%I1%' THEN 'I1'
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%I2%' THEN 'I2'
        WHEN UPPER(COALESCE(p.name, '')) LIKE '%TRONCAL%' THEN 'TRONCAL'
        ELSE 'OTRO'
      END
    ) AS sector_codigo,
    p.camera_type,
    p.element_type,
    p.execution_status,
    COALESCE(
      p.progress_percentage,
      CASE
        WHEN p.execution_status = 'Terminado' THEN 100
        WHEN p.execution_status = 'No iniciado' THEN 0
        ELSE 50
      END
    ) AS porcentaje_avance,
    p.acta
  FROM public.inspection_photos p
  WHERE p.element_type = 'camara' OR (p.element_type IS NULL AND p.camera_code IS NOT NULL)
)
SELECT
  sector,
  sector_codigo,
  COUNT(*) AS total_camaras,
  -- Por Tipo de Red
  COUNT(CASE WHEN camera_type = 'MT' OR (camera_type IS NULL AND element_type = 'camara') THEN 1 END) AS camaras_mt,
  COUNT(CASE WHEN camera_type = 'BT' THEN 1 END) AS camaras_bt,
  COUNT(CASE WHEN camera_type ILIKE '%dato%' OR camera_type = 'D' THEN 1 END) AS camaras_datos,
  -- Por Estado de Ejecución
  COUNT(CASE WHEN execution_status = 'No iniciado' OR execution_status IS NULL OR execution_status = '' THEN 1 END) AS pendientes_no_iniciado,
  COUNT(CASE WHEN execution_status = 'En proceso' THEN 1 END) AS en_progreso,
  COUNT(CASE WHEN execution_status = 'Terminado' THEN 1 END) AS terminadas,
  -- Por Acta
  COUNT(CASE WHEN acta = 'Acta 1' THEN 1 END) AS en_acta_1,
  COUNT(CASE WHEN acta = 'Acta 2' THEN 1 END) AS en_acta_2,
  COUNT(CASE WHEN acta = 'Acta 3' THEN 1 END) AS en_acta_3,
  COUNT(CASE WHEN acta IS NULL OR acta = '' THEN 1 END) AS sin_acta,
  -- Porcentaje de Avance Real Promedio de Cámaras
  ROUND(AVG(porcentaje_avance)::numeric, 1) AS porcentaje_avance_estimado
FROM camaras_clasificadas
GROUP BY sector, sector_codigo
ORDER BY sector;

-- 4. Vista de Resumen General por Acta (Cámaras, Tuberías y Metros Lineales Reales)
DROP VIEW IF EXISTS public.v_resumen_global_por_acta CASCADE;

CREATE OR REPLACE VIEW public.v_resumen_global_por_acta AS
SELECT
  COALESCE(NULLIF(p.acta, ''), 'Sin Acta Asignada') AS acta,
  CASE
    WHEN UPPER(p.name) LIKE '%I1%' THEN 'Intersección 1'
    WHEN UPPER(p.name) LIKE '%I2%' THEN 'Intersección 2'
    WHEN UPPER(p.name) LIKE '%TRONCAL%' THEN 'Troncal Principal'
    ELSE 'Otros Sectores'
  END AS sector,
  COUNT(CASE WHEN p.element_type = 'camara' THEN 1 END) AS total_camaras,
  COUNT(CASE WHEN p.element_type = 'tuberia' THEN 1 END) AS total_tramos,
  ROUND(SUM(CASE WHEN p.element_type = 'tuberia' THEN COALESCE(NULLIF(p.metraje, '')::numeric, 0) ELSE 0 END), 2) AS distancia_trazas_metros,
  ROUND(
    SUM(
      CASE
        WHEN p.element_type = 'tuberia' THEN
          COALESCE(
            p.linear_meters,
            ROUND(
              COALESCE(NULLIF(SUBSTRING(TRIM(p.tramo) FROM '^([0-9]+)\s*[xX*]'), '')::numeric, 1) *
              COALESCE(NULLIF(p.metraje, '')::numeric, 0),
              2
            )
          )
        ELSE 0
      END
    ),
    2
  ) AS metros_lineales_reales,
  ROUND(
    AVG(
      COALESCE(
        p.progress_percentage,
        CASE
          WHEN p.execution_status = 'Terminado' THEN 100
          WHEN p.execution_status = 'No iniciado' THEN 0
          ELSE 50
        END
      )
    )::numeric,
    1
  ) AS porcentaje_avance_promedio,
  COUNT(CASE WHEN p.execution_status = 'Terminado' THEN 1 END) AS elementos_terminados,
  COUNT(CASE WHEN p.execution_status = 'En proceso' THEN 1 END) AS elementos_en_proceso,
  COUNT(CASE WHEN p.execution_status = 'No iniciado' OR p.execution_status IS NULL THEN 1 END) AS elementos_pendientes
FROM public.inspection_photos p
GROUP BY acta, sector
ORDER BY acta, sector;

-- 3. TABLA DE REGISTRO DE ACTIVIDADES Y AUDITORÍA (inspection_activities)
CREATE TABLE IF NOT EXISTS public.inspection_activities (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  photo_name TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'upload' CHECK (type IN ('upload', 'sync', 'edit', 'flag', 'verified')),
  user_id TEXT,
  sector TEXT,
  sector_code TEXT,
  progress_percentage NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inspection_activities') THEN
    ALTER TABLE public.inspection_activities ADD COLUMN IF NOT EXISTS sector TEXT;
    ALTER TABLE public.inspection_activities ADD COLUMN IF NOT EXISTS sector_code TEXT;
    ALTER TABLE public.inspection_activities ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC;
    UPDATE public.inspection_activities
    SET
      sector_code = CASE
        WHEN UPPER(photo_name) LIKE '%I1%' THEN 'I1'
        WHEN UPPER(photo_name) LIKE '%I2%' THEN 'I2'
        WHEN UPPER(photo_name) LIKE '%TRONCAL%' THEN 'TRONCAL'
        ELSE 'OTRO'
      END,
      sector = CASE
        WHEN UPPER(photo_name) LIKE '%I1%' THEN 'Intersección 1'
        WHEN UPPER(photo_name) LIKE '%I2%' THEN 'Intersección 2'
        WHEN UPPER(photo_name) LIKE '%TRONCAL%' THEN 'Troncal Principal'
        ELSE 'Otros Sectores'
      END;
  END IF;
END $$;

-- 4. TABLA DE COLECCIONES Y CARPETAS DE INSPECCIÓN (inspection_collections)
CREATE TABLE IF NOT EXISTS public.inspection_collections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  item_count INTEGER NOT NULL DEFAULT 0,
  cover_image TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  last_updated TEXT NOT NULL,
  photo_ids JSONB DEFAULT '[]'::jsonb,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABLA DE PREFERENCIAS DE LA APLICACIÓN (app_settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_settings',
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT false,
  sync_wifi_only BOOLEAN NOT NULL DEFAULT true,
  high_quality_uploads BOOLEAN NOT NULL DEFAULT false,
  auto_verify_passed BOOLEAN NOT NULL DEFAULT true,
  offline_storage_limit_mb INTEGER NOT NULL DEFAULT 500,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================
-- ÍNDICES DE RENDIMIENTO (Búsquedas rápidas por fecha, estado y código)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inspection_photos_date ON public.inspection_photos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_execution_status ON public.inspection_photos (execution_status);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_status ON public.inspection_photos (status);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_location ON public.inspection_photos (location);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_camera_code ON public.inspection_photos (camera_code);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_camera_type ON public.inspection_photos (camera_type);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_pipe_network ON public.inspection_photos (pipe_network_type);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_element_type ON public.inspection_photos (element_type);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspector_id ON public.inspection_photos (inspector_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.inspection_activities (created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Acceso a datos
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Funciones y políticas de acceso por rol y módulo.
CREATE OR REPLACE FUNCTION public.photovault_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT lower(email) = 'jheanmurillo73@gmail.com' OR role = 'admin'
    FROM public.profiles WHERE id = auth.uid()::text
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.photovault_can_access_module(module_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.photovault_is_admin() OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()::text AND allowed_modules @> jsonb_build_array(module_name)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_photovault_profile_access()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(COALESCE(NEW.email, '')) = 'jheanmurillo73@gmail.com' THEN
    NEW.role := 'admin';
    NEW.allowed_modules := '["dashboard", "map", "database", "upload", "history", "activity", "settings"]'::jsonb;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.role := 'inspector';
    NEW.allowed_modules := '["dashboard", "map", "upload", "history"]'::jsonb;
  ELSIF NOT public.photovault_is_admin() THEN
    NEW.role := OLD.role;
    NEW.allowed_modules := OLD.allowed_modules;
  END IF;
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    NEW.email_confirmed_at := OLD.email_confirmed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_photovault_profile_access ON public.profiles;
CREATE TRIGGER protect_photovault_profile_access
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_photovault_profile_access();

-- Mantiene el estado de correo confirmado sincronizado desde Auth sin exponer auth.users al cliente.
CREATE OR REPLACE FUNCTION public.sync_photovault_auth_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, email_confirmed_at, role, allowed_modules)
  VALUES (
    NEW.id::text,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.email_confirmed_at,
    CASE WHEN lower(NEW.email) = 'jheanmurillo73@gmail.com' THEN 'admin' ELSE 'inspector' END,
    CASE WHEN lower(NEW.email) = 'jheanmurillo73@gmail.com'
      THEN '["dashboard", "map", "database", "upload", "history", "activity", "settings"]'::jsonb
      ELSE '["dashboard", "map", "upload", "history"]'::jsonb
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_photovault_auth_profile ON auth.users;
CREATE TRIGGER sync_photovault_auth_profile
AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_photovault_auth_profile();

DROP POLICY IF EXISTS "Acceso total a perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Perfil propio o administracion" ON public.profiles;
DROP POLICY IF EXISTS "Crear perfil propio" ON public.profiles;
DROP POLICY IF EXISTS "Actualizar perfil propio o administracion" ON public.profiles;
CREATE POLICY "Perfil propio o administracion" ON public.profiles FOR SELECT
USING (id = auth.uid()::text OR public.photovault_is_admin());
CREATE POLICY "Crear perfil propio" ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid()::text);
CREATE POLICY "Actualizar perfil propio o administracion" ON public.profiles FOR UPDATE
USING (id = auth.uid()::text OR public.photovault_is_admin())
WITH CHECK (id = auth.uid()::text OR public.photovault_is_admin());

DROP POLICY IF EXISTS "Acceso total a fotos de inspeccion" ON public.inspection_photos;
DROP POLICY IF EXISTS "Lectura de inspecciones por modulo" ON public.inspection_photos;
DROP POLICY IF EXISTS "Escritura de inspecciones por modulo" ON public.inspection_photos;
CREATE POLICY "Lectura de inspecciones por modulo" ON public.inspection_photos FOR SELECT
USING (
  public.photovault_can_access_module('dashboard') OR
  public.photovault_can_access_module('map') OR
  public.photovault_can_access_module('database') OR
  public.photovault_can_access_module('history')
);
CREATE POLICY "Escritura de inspecciones por modulo" ON public.inspection_photos FOR ALL
USING (public.photovault_can_access_module('upload'))
WITH CHECK (public.photovault_can_access_module('upload'));

DROP POLICY IF EXISTS "Acceso total a actividades" ON public.inspection_activities;
DROP POLICY IF EXISTS "Acceso a actividades por modulo" ON public.inspection_activities;
CREATE POLICY "Acceso a actividades por modulo" ON public.inspection_activities FOR ALL
USING (public.photovault_can_access_module('activity') OR public.photovault_can_access_module('upload'))
WITH CHECK (public.photovault_can_access_module('activity') OR public.photovault_can_access_module('upload'));

DROP POLICY IF EXISTS "Acceso total a colecciones" ON public.inspection_collections;
DROP POLICY IF EXISTS "Acceso a colecciones por modulo" ON public.inspection_collections;
CREATE POLICY "Acceso a colecciones por modulo" ON public.inspection_collections FOR ALL
USING (public.photovault_can_access_module('history'))
WITH CHECK (public.photovault_can_access_module('history'));

DROP POLICY IF EXISTS "Acceso total a configuracion" ON public.app_settings;
DROP POLICY IF EXISTS "Acceso a configuracion por modulo" ON public.app_settings;
CREATE POLICY "Acceso a configuracion por modulo" ON public.app_settings FOR ALL
USING (public.photovault_can_access_module('settings'))
WITH CHECK (public.photovault_can_access_module('settings'));

-- Restablecimiento administrativo: conserva perfiles, roles, permisos y configuración.
CREATE OR REPLACE FUNCTION public.reset_inspection_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.photovault_is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede restablecer los datos de inspección.';
  END IF;

  -- La condición explícita conserva la compatibilidad con la protección
  -- del proyecto que bloquea DELETE sin WHERE. id es la clave primaria de
  -- estas tres tablas, por lo que no excluye ningún registro operativo.
  DELETE FROM public.inspection_collections WHERE id IS NOT NULL;
  DELETE FROM public.inspection_activities WHERE id IS NOT NULL;
  DELETE FROM public.inspection_photos WHERE id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_inspection_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_inspection_data() TO authenticated;

-- Notificar recarga de caché
NOTIFY pgrst, 'reload schema';
`;
  },
};
