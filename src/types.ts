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

export const getElectricalPlanArea = (
  electricalType?: ElectricalElementType,
  cableType?: CableType,
  currentPlanArea?: PlanArea,
): PlanArea => {
  if (currentPlanArea === 'electrical_lighting' || electricalType === 'poste_alumbrado' || cableType === 'alumbrado') {
    return 'electrical_lighting';
  }
  if (currentPlanArea === 'electrical_bt' || cableType === 'baja_tension') {
    return 'electrical_bt';
  }
  return 'electrical_mt';
};

export const getPhotoPlanArea = (photo: {
  planArea?: PlanArea;
  electricalType?: ElectricalElementType;
  cableType?: CableType;
  elementType?: ElementType;
}): PlanArea => {
  if (photo.cableType === 'alumbrado' || photo.electricalType === 'poste_alumbrado' || photo.planArea === 'electrical_lighting') {
    return 'electrical_lighting';
  }
  if (photo.planArea === 'electrical_mt') {
    return 'electrical_mt';
  }
  if (photo.planArea === 'electrical_bt') {
    return 'electrical_mt';
  }
  if (photo.planArea === 'electrical') {
    return getElectricalPlanArea(photo.electricalType, photo.cableType, photo.planArea);
  }
  return photo.planArea || 'civil';
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

export type NetworkCategory = 'MT' | 'BT' | 'DATOS';

export interface PhotoNetworkInfo {
  primary: NetworkCategory;
  all: NetworkCategory[];
  isMultiNetwork?: boolean;
  multiLabel?: string;
  label: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  lightBadgeClass: string;
  icon: string;
}

export const getPhotoNetworkInfo = (photo?: Partial<InspectionPhoto> | null): PhotoNetworkInfo => {
  if (!photo) {
    return {
      primary: 'MT',
      all: ['MT'],
      isMultiNetwork: false,
      multiLabel: 'MT',
      label: 'Media Tensión (MT)',
      color: '#1565c0',
      badgeBg: 'bg-[#1565c0]',
      badgeText: 'text-white',
      lightBadgeClass: 'bg-blue-50 text-[#004d99] border-blue-200',
      icon: 'bolt',
    };
  }

  const networks = new Set<NetworkCategory>();
  const isPipe = photo.elementType === 'tuberia' || (Array.isArray(photo.pipeConduits) && photo.pipeConduits.length > 0) || Boolean(photo.tramo);

  // 1. Tubería / Tramos (conduits y pipeNetworkType)
  if (Array.isArray(photo.pipeConduits) && photo.pipeConduits.length > 0) {
    photo.pipeConduits.forEach((conduit) => {
      if (conduit.networkType === 'media_tension') networks.add('MT');
      else if (conduit.networkType === 'baja_tension') networks.add('BT');
      else if (conduit.networkType === 'datos') networks.add('DATOS');
    });
  }

  if (photo.pipeNetworkType === 'media_tension') networks.add('MT');
  else if (photo.pipeNetworkType === 'baja_tension') networks.add('BT');
  else if (photo.pipeNetworkType === 'datos') networks.add('DATOS');

  // 2. Eléctrico / Cableado
  if (photo.cableType === 'media_tension' || photo.planArea === 'electrical_mt') networks.add('MT');
  else if (photo.cableType === 'baja_tension' || photo.planArea === 'electrical_bt') networks.add('BT');
  else if (photo.cableType === 'alumbrado' || photo.planArea === 'electrical_lighting') networks.add('BT');

  // 3. Cámara (solo si no es tubería pura o si aún no hay redes detectadas)
  if (!isPipe || networks.size === 0) {
    const rawCameraType = (photo.cameraType || '').trim().toUpperCase();
    if (rawCameraType === 'MT') networks.add('MT');
    else if (rawCameraType === 'BT') networks.add('BT');
    else if (rawCameraType === 'DATOS' || rawCameraType === 'D') networks.add('DATOS');
  }

  // Fallback si no hay red identificada
  if (networks.size === 0) {
    const nameLower = (photo.name || '').toLowerCase();
    const notesLower = (photo.fieldNotes || '').toLowerCase();
    if (nameLower.includes('dato') || notesLower.includes('dato')) {
      networks.add('DATOS');
    } else if (nameLower.includes('baja') || notesLower.includes('baja')) {
      networks.add('BT');
    } else {
      networks.add('MT');
    }
  }

  const all = Array.from(networks);
  const primary = all[0] || 'MT';
  const isMultiNetwork = all.length > 1;
  const multiLabel = all.join(' + ');

  if (primary === 'DATOS') {
    return {
      primary: 'DATOS',
      all,
      isMultiNetwork,
      multiLabel,
      label: isMultiNetwork ? `Datos / Control (+${all.filter(n => n !== 'DATOS').join(', ')})` : 'Datos / Control',
      color: '#0D9FC6',
      badgeBg: 'bg-[#0D9FC6]',
      badgeText: 'text-white',
      lightBadgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
      icon: 'lan',
    };
  }

  if (primary === 'BT') {
    return {
      primary: 'BT',
      all,
      isMultiNetwork,
      multiLabel,
      label: isMultiNetwork ? `Baja Tensión (+${all.filter(n => n !== 'BT').join(', ')})` : 'Baja Tensión (BT)',
      color: '#EAB308',
      badgeBg: 'bg-amber-600',
      badgeText: 'text-white',
      lightBadgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: 'electric_bolt',
    };
  }

  return {
    primary: 'MT',
    all,
    isMultiNetwork,
    multiLabel,
    label: isMultiNetwork ? `Media Tensión (+${all.filter(n => n !== 'MT').join(', ')})` : 'Media Tensión (MT)',
    color: '#1565c0',
    badgeBg: 'bg-[#1565c0]',
    badgeText: 'text-white',
    lightBadgeClass: 'bg-blue-50 text-[#004d99] border-blue-200',
    icon: 'bolt',
  };
};

export const matchesNetworkFilter = (
  photo: Partial<InspectionPhoto> | undefined,
  filterValue: string,
): boolean => {
  if (!photo || !filterValue || filterValue === 'all') return true;
  const target = filterValue.toUpperCase();
  const info = getPhotoNetworkInfo(photo);

  if (target === 'MT' || target === 'MEDIA_TENSION') {
    return info.all.includes('MT');
  }
  if (target === 'BT' || target === 'BAJA_TENSION') {
    return info.all.includes('BT');
  }
  if (target === 'DATOS' || target === 'DATA') {
    return info.all.includes('DATOS');
  }
  return info.primary === target;
};

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
  linearMeters?: number; // Metros lineales reales (multiplicador * distancia)
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
  sector?: string;
  sectorCode?: SectorCode;
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

/**
 * Extrae el multiplicador de ductos de una configuración de tramo.
 * Ejemplos:
 *  - "2x4\""  -> 2
 *  - "20x6\"" -> 20
 *  - "3x4\""  -> 3
 *  - "4\""    -> 1
 */
export const extractTramoMultiplier = (configuration?: string): number => {
  if (!configuration) return 1;
  const cleaned = configuration.trim();
  const match = cleaned.match(/^(\d+)\s*(?:x|[X*])/);
  if (match) {
    const mult = parseInt(match[1], 10);
    return Number.isFinite(mult) && mult > 0 ? mult : 1;
  }
  return 1;
};

export const getTramoMultiplier = extractTramoMultiplier;

/**
 * Calcula los metros lineales reales multiplicando el multiplicador de ductos por la distancia física.
 * Ejemplos:
 *  - 2x4", 100 mts  -> 2 * 100 = 200 metros lineales
 *  - 20x6", 100 mts -> 20 * 100 = 2000 metros lineales
 */
export const calculateRealLinearMeters = (configuration?: string, meters?: string | number): number => {
  const dist = typeof meters === 'number' ? meters : parseFloat(String(meters || '0').replace(',', '.'));
  if (!Number.isFinite(dist) || dist <= 0) return 0;
  const mult = extractTramoMultiplier(configuration);
  return Math.round(mult * dist * 100) / 100;
};

/**
 * Calcula los metros lineales reales acumulados para un elemento de tipo tubería o tramo.
 */
export const getPhotoRealLinearMeters = (photo: InspectionPhoto): {
  totalLinearMeters: number;
  distanceMeters: number;
  multiplier: number;
} => {
  const conduits = photo.pipeConduits;
  if (conduits && conduits.length > 0) {
    let totalLinear = 0;
    let totalDist = 0;
    let maxMult = 1;
    conduits.forEach((c) => {
      const dist = parseFloat(String(c.meters || '0').replace(',', '.')) || 0;
      const mult = extractTramoMultiplier(c.configuration);
      totalLinear += mult * dist;
      totalDist += dist;
      if (mult > maxMult) maxMult = mult;
    });
    return {
      totalLinearMeters: Math.round(totalLinear * 100) / 100,
      distanceMeters: Math.round(totalDist * 100) / 100,
      multiplier: maxMult,
    };
  }

  const dist = parseFloat(String(photo.metraje || '0').replace(',', '.')) || 0;
  const mult = extractTramoMultiplier(photo.tramo);
  return {
    totalLinearMeters: Math.round(mult * dist * 100) / 100,
    distanceMeters: Math.round(dist * 100) / 100,
    multiplier: mult,
  };
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

export type SectorCode = 'I1' | 'I2' | 'TRONCAL' | 'OTRO';

export interface ElementSectorInfo {
  code: SectorCode;
  label: string;
  badgeClass: string;
  bgClass: string;
}

/**
 * Determina el sector de cualquier elemento (cámara o tramo de tubería):
 * - Contiene 'I1' -> Intersección 1
 * - Contiene 'I2' -> Intersección 2
 * - Contiene 'TRONCAL' -> Área Troncal / Troncal Principal
 */
export const getElementSector = (name?: string): ElementSectorInfo => {
  const upper = (name || '').toUpperCase();
  if (upper.includes('I1')) {
    return {
      code: 'I1',
      label: 'Intersección 1',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-200',
      bgClass: 'bg-blue-600',
    };
  }
  if (upper.includes('I2')) {
    return {
      code: 'I2',
      label: 'Intersección 2',
      badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
      bgClass: 'bg-indigo-600',
    };
  }
  if (upper.includes('TRONCAL')) {
    return {
      code: 'TRONCAL',
      label: 'Troncal Principal',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      bgClass: 'bg-emerald-600',
    };
  }
  return {
    code: 'OTRO',
    label: 'Otros Sectores',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    bgClass: 'bg-slate-500',
  };
};
