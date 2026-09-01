/**
 * Diseño: cartografía técnica sobria. El modelo conserva categorías operativas
 * independientes para impedir que un elemento del plano herede datos ajenos.
 */
export type SyncStatus = 'Synced' | 'In Progress' | 'Flagged';

export type ExecutionStatus = 'No iniciado' | 'En proceso' | 'Terminado';

export type CameraCode = 'SB850' | 'SB851' | 'SB858' | string;

export type CameraType = 'MT' | 'BT' | 'Datos' | string;

export type ElementType = 'caja' | 'camara' | 'tuberia' | 'electrico';

export type PlanArea = 'civil' | 'electrical' | 'electrical_mt' | 'electrical_bt' | 'electrical_lighting';

export type ElectricalElementType =
  | 'transformador'
  | 'tablero_baja_tension'
  | 'tablero_distribucion'
  | 'barrajes_elastomericos'
  | 'malla_tierra'
  | 'poste_media_tension'
  | 'poste_alumbrado'
  | 'reconectador'
  | 'cableado';

export type CableType = 'media_tension' | 'baja_tension' | 'alumbrado';
export type CableGauge = '12' | '10' | '8' | '6' | '4' | '2' | '1/0' | '2/0' | '3/0' | '4/0' | '250' | '350' | '500';

export interface EvidenceTimelineEntry {
  url: string;
  capturedAt: string;
}

export const CABLE_TYPE_OPTIONS: ReadonlyArray<{ value: CableType; label: string; color: string }> = [
  { value: 'media_tension', label: 'Media tensión', color: '#6D28D9' },
  { value: 'baja_tension', label: 'Baja tensión', color: '#0369A1' },
  { value: 'alumbrado', label: 'Alumbrado', color: '#CA8A04' },
];

export const CABLE_GAUGE_OPTIONS: ReadonlyArray<CableGauge> = ['12', '10', '8', '6', '4', '2', '1/0', '2/0', '3/0', '4/0', '250', '350', '500'];
export const LIGHTING_CABLE_GAUGE_OPTIONS: ReadonlyArray<CableGauge> = ['12', '10', '8', '6'];

export const getCableGaugeOptionsForPlanArea = (planArea?: PlanArea): ReadonlyArray<CableGauge> =>
  planArea === 'electrical_lighting' ? LIGHTING_CABLE_GAUGE_OPTIONS : CABLE_GAUGE_OPTIONS;

export const getCableTypeOption = (value?: string) =>
  CABLE_TYPE_OPTIONS.find((option) => option.value === value) || CABLE_TYPE_OPTIONS[0];

export const ELECTRICAL_ELEMENT_OPTIONS: ReadonlyArray<{
  value: ElectricalElementType;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
}> = [
  { value: 'transformador', label: 'Transformador', shortLabel: 'Transformador', icon: 'transform', color: '#7C3AED' },
  { value: 'tablero_baja_tension', label: 'Tablero de baja tensión', shortLabel: 'Tablero BT', icon: 'developer_board', color: '#0369A1' },
  { value: 'tablero_distribucion', label: 'Tablero de distribución', shortLabel: 'Tablero distribución', icon: 'switch', color: '#075985' },
  { value: 'barrajes_elastomericos', label: 'Barrajes elastoméricos', shortLabel: 'Barrajes', icon: 'splitscreen', color: '#C2410C' },
  { value: 'malla_tierra', label: 'Malla a tierra', shortLabel: 'Malla a tierra', icon: 'grid_4x4', color: '#15803D' },
  { value: 'poste_media_tension', label: 'Poste de media tensión', shortLabel: 'Poste MT', icon: 'cell_tower', color: '#B91C1C' },
  { value: 'poste_alumbrado', label: 'Poste de alumbrado', shortLabel: 'Poste alumbrado', icon: 'light', color: '#CA8A04' },
  { value: 'reconectador', label: 'Reconectador', shortLabel: 'Reconectador', icon: 'power', color: '#9F1239' },
  { value: 'cableado', label: 'Cableado eléctrico', shortLabel: 'Cableado', icon: 'cable', color: '#6D28D9' },
];

export const getElectricalElementOption = (value?: string) =>
  ELECTRICAL_ELEMENT_OPTIONS.find((option) => option.value === value) || ELECTRICAL_ELEMENT_OPTIONS[0];

export const isElectricalElementType = (value?: string): value is ElectricalElementType =>
  ELECTRICAL_ELEMENT_OPTIONS.some((option) => option.value === value);

export const getElectricalPlanArea = (electricalType?: ElectricalElementType): PlanArea => {
  if (electricalType === 'poste_alumbrado') return 'electrical_lighting';
  // Reorganización: Tablero de distribución, Malla a tierra y resto de elementos eléctricos se agrupan en MT
  return 'electrical_mt';
};

export type PipeNetworkType = 'media_tension' | 'baja_tension' | 'datos';

export interface PipeConduit {
  id: string;
  networkType: PipeNetworkType;
  configuration: string;
  meters: number | string;
}

export const getDefaultPipeConfiguration = (networkType: PipeNetworkType): string =>
  networkType === 'baja_tension' ? '2x6"' : '3x4"';

const isPipeNetworkType = (value: unknown): value is PipeNetworkType =>
  value === 'media_tension' || value === 'baja_tension' || value === 'datos';

export const normalizePipeConduits = (
  value: unknown,
  legacy?: Partial<Pick<PipeConduit, 'networkType' | 'configuration' | 'meters'>>,
): PipeConduit[] => {
  const candidates = Array.isArray(value) ? value : [];
  const conduits = candidates.reduce<PipeConduit[]>((items, candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return items;
    const item = candidate as Partial<PipeConduit>;
    if (!isPipeNetworkType(item.networkType)) return items;
    const configuration = typeof item.configuration === 'string' && item.configuration.trim()
      ? item.configuration.trim()
      : getDefaultPipeConfiguration(item.networkType);
    const meters = typeof item.meters === 'number' || (typeof item.meters === 'string' && item.meters.trim())
      ? item.meters
      : 0;
    items.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id : `${item.networkType}-${index + 1}`,
      networkType: item.networkType,
      configuration,
      meters,
    });
    return items;
  }, []);

  if (conduits.length > 0 || !legacy || !isPipeNetworkType(legacy.networkType)) return conduits;
  return [{
    id: `${legacy.networkType}-1`,
    networkType: legacy.networkType,
    configuration: typeof legacy.configuration === 'string' && legacy.configuration.trim()
      ? legacy.configuration.trim()
      : getDefaultPipeConfiguration(legacy.networkType),
    meters: legacy.meters ?? 0,
  }];
};

export const PIPE_NETWORK_OPTIONS: ReadonlyArray<{
  value: PipeNetworkType;
  label: string;
  color: string;
  icon: string;
}> = [
  { value: 'media_tension', label: 'Media tensión', color: '#DC2626', icon: 'bolt' },
  { value: 'baja_tension', label: 'Baja tensión', color: '#EAB308', icon: 'electric_bolt' },
  { value: 'datos', label: 'Datos', color: '#0D9FC6', icon: 'lan' },
];

export const getPipeNetworkOption = (value?: string) =>
  PIPE_NETWORK_OPTIONS.find((option) => option.value === value) || PIPE_NETWORK_OPTIONS[1];

export type ActaLabelPosition = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

export interface ActaItem {
  code: string;
  description: string;
  unit: string;
  quantity: string;
  section: string;
}

export type AppRole = 'admin' | 'inspector';

export type AppModule =
  | 'dashboard'
  | 'map'
  | 'database'
  | 'upload'
  | 'history'
  | 'activity'
  | 'settings';

export interface UserAccess {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  allowedModules: AppModule[];
  emailConfirmedAt?: string | null;
}

export type PhotoCategory = 'inspection' | 'maintenance' | 'site_visit' | 'safety_hazard' | 'structural' | 'electrical';

export interface InspectionPhoto {
  id: string;
  displayId: string;
  name: string;
  imageUrl: string;
  imageUrls?: string[];
  evidenceTimeline?: EvidenceTimelineEntry[];
  date: string;
  dateRaw: string;
  status: SyncStatus;
  executionStatus: ExecutionStatus;
  progressPercentage?: number; // Porcentaje de avance de 0 a 100
  category: PhotoCategory;
  categoryLabel: string;
  location: string;
  cameraCode?: CameraCode;
  cameraType?: CameraType;
  acta?: string;
  actaItem?: ActaItem;
  actaItems?: ActaItem[];
  showActaLabel?: boolean;
  actaLabelPosition?: ActaLabelPosition;
  tramo?: string;
  metraje?: number | string;
  pipeNetworkType?: PipeNetworkType;
  pipeColor?: string;
  pipeConduits?: PipeConduit[];
  latitude?: number;
  longitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  planX?: number;
  planY?: number;
  planEndX?: number;
  planEndY?: number;
  planArea?: PlanArea;
  electricalType?: ElectricalElementType;
  electricalColor?: string;
  cableType?: CableType;
  cableGauge?: CableGauge;
  cableMeters?: number | string;
  inspectorName: string;
  inspectorId: string;
  inspectorAvatar: string;
  type: string;
  elementType?: ElementType;
  verified: boolean;
  fieldNotes: string;
  requiresImmediateAction: boolean;
  fileSize?: string;
  resolution?: string;
}

export const normalizeEvidenceTimeline = (
  photo: Pick<InspectionPhoto, 'imageUrl' | 'imageUrls' | 'evidenceTimeline' | 'dateRaw'>,
): EvidenceTimelineEntry[] => {
  const urls = (photo.imageUrls?.length ? photo.imageUrls : [photo.imageUrl])
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0 && !url.startsWith('data:image/svg+xml'));
  const recordedEntries = Array.isArray(photo.evidenceTimeline) ? photo.evidenceTimeline : [];
  const fallbackDate = photo.dateRaw || new Date().toISOString();

  return urls.map((url) => {
    const recorded = recordedEntries.find((entry) => entry?.url === url && typeof entry.capturedAt === 'string' && entry.capturedAt.trim());
    return { url, capturedAt: recorded?.capturedAt || fallbackDate };
  });
};

export const groupEvidenceTimelineByDate = (entries: EvidenceTimelineEntry[]) => {
  const ordered = [...entries].sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt));
  return ordered.reduce<Array<{ day: string; entries: EvidenceTimelineEntry[] }>>((groups, entry) => {
    const parsedDate = new Date(entry.capturedAt);
    const day = Number.isNaN(parsedDate.getTime()) ? 'Sin fecha' : parsedDate.toISOString().slice(0, 10);
    const group = groups.find((item) => item.day === day);
    if (group) group.entries.push(entry);
    else groups.push({ day, entries: [entry] });
    return groups;
  }, []);
};

/**
 * Mantiene los registros creados antes de esta mejora: aquellos con metraje o
 * tramo se interpretan como tubería; el resto conserva el comportamiento de caja.
 */
export const getElementType = (
  element: Pick<InspectionPhoto, 'elementType' | 'tramo' | 'metraje' | 'electricalType' | 'planArea' | 'cameraCode' | 'pipeConduits'>,
): ElementType => element.electricalType || element.planArea === 'electrical'
  ? 'electrico'
  : element.pipeConduits?.length || element.tramo || element.metraje
    ? 'tuberia'
    : element.elementType || (element.cameraCode ? 'camara' : 'caja');

export const isCable = (element: Pick<InspectionPhoto, 'electricalType'>): boolean =>
  element.electricalType === 'cableado';

export interface BlueprintOverlay {
  id: string;
  name: string;
  imageUrl: string;
  opacity: number; // 0 to 1
  visible: boolean;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  rotation?: number; // degrees
  scale?: number;
  calibration?: BlueprintCalibration;
}

/**
 * Escala construida al marcar un tramo conocido del JPG. Las unidades del
 * plano preservan la relación de aspecto, por lo que el zoom no afecta el
 * cálculo final en metros.
 */
export interface BlueprintCalibration {
  referenceDistanceMeters: number;
  referenceDistancePlanUnits: number;
  aspectRatio: number;
  calibratedAt: string;
}

export interface InspectorProfile {
  name: string;
  role: string;
  terminal: string;
  id: string;
  email: string;
  avatarUrl: string;
  phone: string;
  department: string;
  // Basic personal data
  documentId?: string; // Cédula / DNI / RUT
  birthDate?: string; // Fecha de nacimiento
  gender?: string; // Género
  city?: string; // Ciudad de residencia
  address?: string; // Dirección
  bloodType?: string; // Grupo Sanguíneo RH (O+, A+, B+, etc.)
  // Emergency contact
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  // Professional & contractor data
  company?: string; // Empresa o Consorcio Contratista
  licenseNumber?: string; // Matrícula Profesional / Certificado CONTE / RETIE
  notes?: string; // Observaciones o notas médicas
}

export interface AppSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  syncWifiOnly: boolean;
  highQualityUploads: boolean;
  allowInspectorActaAssignment: boolean;
  autoVerifyPassed: boolean;
  offlineStorageLimitMb: number;
}

export const getPhotoProgressPercentage = (
  photo?: Pick<InspectionPhoto, 'progressPercentage' | 'executionStatus'> | null,
): number => {
  if (!photo) return 0;
  if (typeof photo.progressPercentage === 'number' && !Number.isNaN(photo.progressPercentage)) {
    return Math.max(0, Math.min(100, Math.round(photo.progressPercentage)));
  }
  if (photo.executionStatus === 'Terminado') return 100;
  if (photo.executionStatus === 'No iniciado') return 0;
  return 50;
};

export type ActivityActionCategory =
  | 'creation'
  | 'progress'
  | 'status'
  | 'measurement'
  | 'evidence'
  | 'location'
  | 'acta'
  | 'deletion'
  | 'edit'
  | 'sync';

export interface ActivityItem {
  id: string;
  timestamp: string;
  action: string;
  photoName: string;
  photoId: string;
  user: string;
  userEmail?: string;
  userRole?: string;
  dateRaw?: string;
  actionCategory?: ActivityActionCategory;
  elementType?: ElementType;
  details?: string;
  previousValue?: string;
  newValue?: string;
  type: 'upload' | 'sync' | 'edit' | 'flag' | 'verified';
}

export interface InspectionCollection {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  coverImage: string;
  category: string;
  lastUpdated: string;
  photoIds: string[];
}
