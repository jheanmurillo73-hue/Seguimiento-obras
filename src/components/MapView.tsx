/**
 * Diseño: plano técnico operativo. El JPG es el lienzo principal, se ajusta por
 * completo al área disponible y las ubicaciones se expresan como porcentajes
 * relativos al plano, nunca como coordenadas de un proveedor cartográfico.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActaLabelPosition, BlueprintCalibration, BlueprintOverlay, ElectricalElementType, ELECTRICAL_ELEMENT_OPTIONS, getCableTypeOption, getElectricalElementOption, getElectricalPlanArea, getElementType, getPhotoProgressPercentage, getPipeNetworkOption, InspectionPhoto, InspectorProfile, isElectricalElementType, PlanArea } from '../types';
import { compressImageForDevice } from '../services/deviceStorageService';
import { isQuotaExceededError, loadBlueprintImage, restoreBlueprintFromSources, saveBlueprintImage } from '../services/blueprintStorageService';
import { BlueprintRevision, getCloudBlueprintRevision, isSupabaseStorageUrl, uploadBlueprintToSupabase } from '../services/supabaseStorageService';
import { getBlueprintSyncPresentation } from '../services/blueprintSyncPresentation';
import { getCameraSelectionLabel } from '../lib/cameraSelectionLabel';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { BulkEditModal } from './BulkEditModal';

interface MapViewProps {
  photos: InspectionPhoto[];
  inspector: InspectorProfile;
  isAdmin: boolean;
  canAssignActa?: boolean;
  onSelectPhoto: (photo: InspectionPhoto) => void;
  onEditPhoto: (photo: InspectionPhoto) => void;
  onUpdatePhoto: (photo: InspectionPhoto) => void;
  onBulkUpdatePhotos?: (photos: InspectionPhoto[], summary?: string) => void;
  onDeletePhotos: (photoIds: string[]) => void;
  onNavigateToUpload: () => void;
  onCreatePhoto: (
    elementType: 'caja' | 'camara' | 'tuberia' | 'electrico',
    position: Pick<InspectionPhoto, 'planX' | 'planY' | 'planEndX' | 'planEndY'>,
    initialMetraje?: number,
    electricalType?: ElectricalElementType,
    electricalArea?: PlanArea,
  ) => InspectionPhoto;
  onUpdatePhotoPosition: (
    photoId: string,
    position: Pick<InspectionPhoto, 'planX' | 'planY' | 'planEndX' | 'planEndY'> & Partial<Pick<InspectionPhoto, 'metraje'>>,
  ) => void;
  onUpdatePipelineMeasurements: (measurements: Array<Pick<InspectionPhoto, 'id' | 'metraje'>>) => void;
  focusElementId?: string | null;
  onFocusElementHandled?: () => void;
}

type PlacementStage = 'point' | 'pipe-start' | 'pipe-end';
type PipeAlignment = 'libre' | 'horizontal' | 'vertical' | 'diagonal';
type CreationMode = 'caja' | 'camara' | 'tuberia' | ElectricalElementType;

interface PlacementTarget {
  photo: InspectionPhoto;
  stage: PlacementStage;
}

interface DragTarget {
  photo: InspectionPhoto;
  source: 'palette' | 'plan';
}

interface PlanPoint {
  planX: number;
  planY: number;
}

interface CalibrationDraft {
  referenceDistancePlanUnits: number;
  referenceDistancePercent: number;
  aspectRatio: number;
}

type PipeGeometry = Required<Pick<InspectionPhoto, 'planX' | 'planY' | 'planEndX' | 'planEndY'>>;

interface PipeDimensionHistoryEntry {
  photoId: string;
  before: PipeGeometry;
  after: PipeGeometry;
}

const EMPTY_BLUEPRINT: BlueprintOverlay = {
  id: 'bp-user',
  name: 'Plano de obra sin cargar',
  imageUrl: '',
  opacity: 1,
  visible: true,
  bounds: { north: 0, south: 0, east: 0, west: 0 },
  rotation: 0,
  scale: 1,
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
const clampScale = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const getPercentDistance = (start: PlanPoint, end: PlanPoint) =>
  Math.hypot(end.planX - start.planX, end.planY - start.planY);
const getPlanDistanceUnits = (start: PlanPoint, end: PlanPoint, aspectRatio: number) =>
  Math.hypot(((end.planX - start.planX) / 100) * aspectRatio, (end.planY - start.planY) / 100);
const getMetersFromPlanPoints = (
  start: PlanPoint,
  end: PlanPoint,
  calibration?: BlueprintCalibration,
) => {
  if (!calibration || calibration.referenceDistancePlanUnits <= 0) return null;
  const units = getPlanDistanceUnits(start, end, calibration.aspectRatio);
  return units * (calibration.referenceDistanceMeters / calibration.referenceDistancePlanUnits);
};
const roundMeters = (value: number) => Math.round(value * 100) / 100;
const alignPipeEnd = (start: PlanPoint, end: PlanPoint, alignment: PipeAlignment): PlanPoint => {
  if (alignment === 'horizontal') return { planX: end.planX, planY: start.planY };
  if (alignment === 'vertical') return { planX: start.planX, planY: end.planY };
  if (alignment === 'diagonal') {
    const distance = Math.max(Math.abs(end.planX - start.planX), Math.abs(end.planY - start.planY));
    return {
      planX: clampPercent(start.planX + Math.sign(end.planX - start.planX || 1) * distance),
      planY: clampPercent(start.planY + Math.sign(end.planY - start.planY || 1) * distance),
    };
  }
  return end;
};

const getActaLabelStyle = (
  planX: number,
  planY: number,
  position: ActaLabelPosition | undefined,
  offset: number,
  textScale: number,
): React.CSSProperties => {
  const base = { left: `${planX}%`, top: `${planY}%` };
  switch (position || 'derecha') {
    case 'izquierda':
      return { ...base, transform: `translate(calc(-100% - ${offset}px), -50%) scale(${textScale})`, transformOrigin: 'right center' };
    case 'arriba':
      return { ...base, transform: `translate(-50%, calc(-100% - ${offset}px)) scale(${textScale})`, transformOrigin: 'center bottom' };
    case 'abajo':
      return { ...base, transform: `translate(-50%, ${offset}px) scale(${textScale})`, transformOrigin: 'center top' };
    default:
      return { ...base, transform: `translate(${offset}px, -50%) scale(${textScale})`, transformOrigin: 'left center' };
  }
};

const getCameraNameStyle = (
  planX: number,
  planY: number,
  offset: number,
  textScale: number,
): React.CSSProperties => ({
  left: `${planX}%`,
  top: `${planY}%`,
  transform: `translate(${offset}px, calc(-100% - 2px)) scale(${textScale})`,
  transformOrigin: 'left bottom',
});

const isPlaced = (photo: InspectionPhoto) =>
  typeof photo.planX === 'number' && typeof photo.planY === 'number';

const hasCompletePipe = (photo: InspectionPhoto) =>
  isPlaced(photo)
  && typeof photo.planEndX === 'number'
  && typeof photo.planEndY === 'number';

const isCable = (photo: InspectionPhoto) => photo.electricalType === 'cableado';
const NO_STARTED_MARKER_COLOR = '#64748b';
const isNotStarted = (photo: InspectionPhoto) => photo.executionStatus === 'No iniciado';

const isElectricalPhoto = (photo: InspectionPhoto) =>
  photo.planArea !== 'civil' && isElectricalElementType(photo.electricalType);

const getPhotoPlanArea = (photo: InspectionPhoto): PlanArea =>
  photo.planArea === 'electrical' || photo.planArea === 'electrical_bt'
    ? getElectricalPlanArea(photo.electricalType)
    : photo.planArea || 'civil';

const PLAN_AREA_DETAILS: Record<'civil' | 'electrical_mt' | 'electrical_lighting', { label: string; shortLabel: string; icon: string; color: string; panel: string }> = {
  civil: { label: 'Obras Civiles', shortLabel: 'CIVIL', icon: 'architecture', color: '#073f74', panel: 'bg-[#eaf6fb]' },
  electrical_mt: { label: 'Obras Eléctricas MT', shortLabel: 'ELÉCTRICA MT', icon: 'bolt', color: '#6d28d9', panel: 'bg-[#f4efff]' },
  electrical_lighting: { label: 'Obras Eléctricas Alumbrado', shortLabel: 'ALUMBRADO', icon: 'light', color: '#CA8A04', panel: 'bg-[#fff8e5]' },
};

const QUICK_PLAN_AREAS = ['civil', 'electrical_mt', 'electrical_lighting'] as const;
type PlanFilter = 'all' | 'camara' | 'caja' | 'tuberia' | 'pending' | 'not_started';
type PlanAreaFilterState = Record<typeof QUICK_PLAN_AREAS[number], PlanFilter>;

const DEFAULT_PLAN_AREA_FILTERS: PlanAreaFilterState = {
  civil: 'all',
  electrical_mt: 'all',
  electrical_lighting: 'all',
};

const isPlanFilter = (value: unknown): value is PlanFilter =>
  value === 'all' || value === 'camara' || value === 'caja' || value === 'tuberia' || value === 'pending' || value === 'not_started';

const elementLabel = (photo: InspectionPhoto) => {
  const type = getElementType(photo);
  if (isElectricalPhoto(photo)) return getElectricalElementOption(photo.electricalType).label;
  if (type === 'camara') return photo.cameraCode || 'Cámara sin código';
  if (type === 'tuberia') return photo.tramo ? `Tramo ${photo.tramo}` : 'Tubería sin tramo';
  return photo.name || 'Caja sin nombre';
};

const cameraNameLabel = (photo: InspectionPhoto) => photo.name?.trim() || photo.cameraCode || 'Cámara sin nombre';
const pipeNameLabel = (photo: InspectionPhoto) => photo.name?.trim() || (photo.tramo ? `Tramo ${photo.tramo}` : 'Tramo de tubería');

export const MapView: React.FC<MapViewProps> = ({
  photos,
  inspector,
  isAdmin,
  canAssignActa = false,
  onSelectPhoto,
  onEditPhoto,
  onUpdatePhoto,
  onBulkUpdatePhotos,
  onDeletePhotos,
  onNavigateToUpload,
  onCreatePhoto,
  onUpdatePhotoPosition,
  onUpdatePipelineMeasurements,
  focusElementId,
  onFocusElementHandled,
}) => {
  const [blueprint, setBlueprint] = useState<BlueprintOverlay>(() => {
    const saved = localStorage.getItem('photovault_blueprint');
    if (!saved) return EMPTY_BLUEPRINT;
    try {
      const parsed = JSON.parse(saved) as Partial<BlueprintOverlay>;
      return {
        ...EMPTY_BLUEPRINT,
        ...parsed,
        imageUrl: '',
        opacity: 1,
        visible: true,
      };
    } catch {
      return EMPTY_BLUEPRINT;
    }
  });
  const [filtersByPlanArea, setFiltersByPlanArea] = useState<PlanAreaFilterState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('photovault_plan_area_filters') || '{}') as Record<string, unknown>;
      return QUICK_PLAN_AREAS.reduce<PlanAreaFilterState>((filters, area) => ({
        ...filters,
        [area]: isPlanFilter(saved[area]) ? saved[area] : 'all',
      }), DEFAULT_PLAN_AREA_FILTERS);
    } catch {
      return DEFAULT_PLAN_AREA_FILTERS;
    }
  });
  const [selectedPlanArea, setSelectedPlanArea] = useState<PlanArea | null>(() => {
    const saved = localStorage.getItem('photovault_last_plan_area');
    return saved === 'civil' || saved === 'electrical_mt' || saved === 'electrical_bt' || saved === 'electrical_lighting'
      ? saved
      : saved === 'electrical' ? 'electrical_mt' : null;
  });
  const [hasPendingPlanChanges, setHasPendingPlanChanges] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [placement, setPlacement] = useState<PlacementTarget | null>(null);
  const [creationMode, setCreationMode] = useState<CreationMode | null>(null);
  const [pipeStart, setPipeStart] = useState<PlanPoint | null>(null);
  const [pipePreview, setPipePreview] = useState<PlanPoint | null>(null);
  const [pipeAlignment, setPipeAlignment] = useState<PipeAlignment>('libre');
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationStart, setCalibrationStart] = useState<PlanPoint | null>(null);
  const [calibrationPreview, setCalibrationPreview] = useState<PlanPoint | null>(null);
  const [calibrationDraft, setCalibrationDraft] = useState<CalibrationDraft | null>(null);
  const [calibrationMeters, setCalibrationMeters] = useState('10');
  const [isCalibrationDialogOpen, setIsCalibrationDialogOpen] = useState(false);
  const [pipeDimensionPercent, setPipeDimensionPercent] = useState('10');
  const [pipeDimensionUndoStack, setPipeDimensionUndoStack] = useState<PipeDimensionHistoryEntry[]>([]);
  const [pipeDimensionRedoStack, setPipeDimensionRedoStack] = useState<PipeDimensionHistoryEntry[]>([]);
  const [selectedPlanPhotoId, setSelectedPlanPhotoId] = useState<string | null>(null);
  const [focusedPlanPhotoId, setFocusedPlanPhotoId] = useState<string | null>(null);
  const [hoveredPlanPhotoId, setHoveredPlanPhotoId] = useState<string | null>(null);
  const [isMultipleSelectionMode, setIsMultipleSelectionMode] = useState(false);
  const [selectedPlanPhotoIds, setSelectedPlanPhotoIds] = useState<string[]>([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [photosPendingDeletion, setPhotosPendingDeletion] = useState<InspectionPhoto[]>([]);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeMapPopover, setActiveMapPopover] = useState<'view' | 'tools' | null>(null);
  const [areSecondaryAccessesCollapsed, setAreSecondaryAccessesCollapsed] = useState(false);
  const [isHandToolActive, setIsHandToolActive] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [iconScale, setIconScale] = useState<number>(() => {
    const saved = Number(localStorage.getItem('photovault_plan_icon_scale'));
    return Number.isFinite(saved) ? clampScale(saved, 0.2, 1.8) : 1;
  });
  const [textScale, setTextScale] = useState<number>(() => {
    const saved = Number(localStorage.getItem('photovault_plan_text_scale'));
    return Number.isFinite(saved) ? clampScale(saved, 0.25, 1.8) : 1;
  });
  const [areActaLabelsVisible, setAreActaLabelsVisible] = useState<boolean>(() =>
    localStorage.getItem('photovault_plan_acta_labels_visible') !== 'false',
  );
  const [areCameraNamesVisible, setAreCameraNamesVisible] = useState<boolean>(() =>
    localStorage.getItem('photovault_plan_camera_names_visible') !== 'false',
  );
  const [arePipeNamesVisible, setArePipeNamesVisible] = useState<boolean>(() =>
    localStorage.getItem('photovault_plan_pipe_names_visible') !== 'false',
  );
  const [blueprintStorageNotice, setBlueprintStorageNotice] = useState<string | null>(null);
  const [blueprintUpdateNotice, setBlueprintUpdateNotice] = useState<string | null>(null);
  const [blueprintRevision, setBlueprintRevision] = useState<BlueprintRevision | null>(null);
  const [isBlueprintLoading, setIsBlueprintLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blueprintStorageReadyRef = useRef(false);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; offsetX: number; offsetY: number } | null>(null);
  const activeFilter: PlanFilter = selectedPlanArea && selectedPlanArea !== 'electrical'
    ? filtersByPlanArea[selectedPlanArea]
    : 'all';
  const blueprintSyncPresentation = getBlueprintSyncPresentation({
    isLoading: isBlueprintLoading,
    isAdmin,
    previousVersion: null,
    revision: blueprintRevision,
  });

  const setActiveFilter = (filter: PlanFilter) => {
    if (!selectedPlanArea || selectedPlanArea === 'electrical') return;
    setFiltersByPlanArea((previous) => ({ ...previous, [selectedPlanArea]: filter }));
  };

  useEffect(() => {
    if (!focusElementId) return;
    const photo = photos.find((item) => item.id === focusElementId);
    if (!photo) {
      onFocusElementHandled?.();
      return;
    }

    const targetArea = getPhotoPlanArea(photo);
    setSelectedPlanArea(targetArea);
    setFiltersByPlanArea((previous) => ({ ...previous, [targetArea]: 'all' }));
    setSearchQuery('');
    setSelectedPlanPhotoId(null);
    setSelectedPlanPhotoIds([]);
    setHoveredPlanPhotoId(null);
    setFocusedPlanPhotoId(photo.id);
    onFocusElementHandled?.();

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`plan-marker-${photo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    });
    const clearFocus = window.setTimeout(() => setFocusedPlanPhotoId(null), 2600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clearFocus);
    };
  }, [focusElementId]);

  useEffect(() => {
    let active = true;
    const restoreUserBlueprint = async () => {
      try {
        const cloudRevisionRequest = getCloudBlueprintRevision().catch(() => null);
        const { cloudImage, imageUrl } = await restoreBlueprintFromSources(
          async () => (await cloudRevisionRequest)?.url || null,
          loadBlueprintImage,
        );
        const cloudRevision = await cloudRevisionRequest;
        // El plano del administrador en Storage es la fuente de verdad. La copia
        // local solo permite continuar trabajando cuando no hay conexión remota.
        const isLegacySvg = imageUrl?.startsWith('data:image/svg+xml');
        if (active && cloudRevision) {
          setBlueprintRevision(cloudRevision);
          if (!isAdmin && cloudRevision.version) {
            const previousVersion = localStorage.getItem('photovault_seen_blueprint_version');
            const message = getBlueprintSyncPresentation({
              isLoading: false,
              isAdmin,
              previousVersion,
              revision: cloudRevision,
            }).updateNotice;
            if (!previousVersion || previousVersion !== cloudRevision.version) {
              setBlueprintUpdateNotice(message);
              try {
                localStorage.setItem('photovault_seen_blueprint_version', cloudRevision.version);
              } catch {
                // El aviso sigue siendo visible durante la sesión aunque el navegador bloquee localStorage.
              }
            }
          }
        }
        if (active && imageUrl && !isLegacySvg) {
          if (cloudImage) {
            try {
              await saveBlueprintImage(cloudImage);
            } catch {
              // El archivo permanece disponible en la nube aunque el navegador no pueda conservar una copia.
            }
          }
          setBlueprint((previous) => ({ ...previous, imageUrl, visible: true, opacity: 1 }));
        }
      } catch {
        // El usuario siempre puede volver a cargar un JPG si el navegador no expone IndexedDB.
      } finally {
        if (active) {
          setIsBlueprintLoading(false);
          blueprintStorageReadyRef.current = true;
        }
      }
    };

    void restoreUserBlueprint();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!blueprintStorageReadyRef.current) return;
    const persistUserBlueprint = async () => {
      const { imageUrl, ...metadata } = blueprint;
      try {
        localStorage.setItem('photovault_blueprint', JSON.stringify({ ...metadata, imageUrl: '' }));
      } catch {
        setBlueprintStorageNotice('No se pudieron guardar los ajustes del plano en este dispositivo.');
      }

      if (!imageUrl || isSupabaseStorageUrl(imageUrl)) return;
      try {
        await saveBlueprintImage(imageUrl);
        setBlueprintStorageNotice(null);
      } catch (error) {
        setBlueprintStorageNotice(
          isQuotaExceededError(error)
            ? 'El JPG es demasiado grande para el almacenamiento disponible. Se mantendrá durante esta sesión.'
            : 'No se pudo conservar el JPG para la próxima sesión.',
        );
      }
    };

    void persistUserBlueprint();
  }, [blueprint]);

  useEffect(() => {
    try {
      localStorage.setItem('photovault_plan_icon_scale', String(iconScale));
    } catch {
      // La escala permanece disponible durante la sesión aunque el navegador no permita persistirla.
    }
  }, [iconScale]);

  useEffect(() => {
    try {
      localStorage.setItem('photovault_plan_text_scale', String(textScale));
    } catch {
      // La escala de textos queda disponible en la sesión aunque no pueda persistirse.
    }
  }, [textScale]);

  useEffect(() => {
    try {
      localStorage.setItem('photovault_plan_acta_labels_visible', String(areActaLabelsVisible));
    } catch {
      // El estado se conserva durante la sesión aunque el navegador no permita persistirlo.
    }
  }, [areActaLabelsVisible]);

  useEffect(() => {
    try {
      localStorage.setItem('photovault_plan_camera_names_visible', String(areCameraNamesVisible));
    } catch {
      // El estado se conserva durante la sesión aunque el navegador no permita persistirlo.
    }
  }, [areCameraNamesVisible]);

  useEffect(() => {
    try {
      localStorage.setItem('photovault_plan_pipe_names_visible', String(arePipeNamesVisible));
    } catch {
      // La preferencia permanece activa durante la sesión aunque el navegador no permita persistirla.
    }
  }, [arePipeNamesVisible]);

  useEffect(() => {
    if (!selectedPlanArea) return;
    try {
      localStorage.setItem('photovault_last_plan_area', selectedPlanArea);
    } catch {
      // El área permanece activa durante esta sesión aunque el navegador no permita persistirla.
    }
  }, [selectedPlanArea]);

  useEffect(() => {
    try {
      localStorage.setItem('photovault_plan_area_filters', JSON.stringify(filtersByPlanArea));
    } catch {
      // Los filtros permanecen disponibles durante la sesión si el navegador no permite persistirlos.
    }
  }, [filtersByPlanArea]);

  useEffect(() => {
    if (!isPanelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPanelOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isPanelOpen]);

  const pendingPhotos = useMemo(
    () => photos.filter((photo) => {
      const type = getElementType(photo);
      const belongsToArea = selectedPlanArea === 'civil'
        ? !isElectricalPhoto(photo)
        : getPhotoPlanArea(photo) === selectedPlanArea;
      return belongsToArea && (type === 'tuberia' || isCable(photo) ? !hasCompletePipe(photo) : !isPlaced(photo));
    }),
    [photos, selectedPlanArea],
  );

  const elementCountByPlanArea = useMemo(
    () => QUICK_PLAN_AREAS.reduce<Record<typeof QUICK_PLAN_AREAS[number], number>>((counts, area) => {
      counts[area] = photos.filter((photo) => area === 'civil'
        ? !isElectricalPhoto(photo)
        : getPhotoPlanArea(photo) === area).length;
      return counts;
    }, { civil: 0, electrical_mt: 0, electrical_lighting: 0 }),
    [photos],
  );

  const visiblePhotos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return photos.filter((photo) => {
      const type = getElementType(photo);
      const belongsToArea = selectedPlanArea === 'civil'
        ? !isElectricalPhoto(photo)
        : getPhotoPlanArea(photo) === selectedPlanArea;
      if (!belongsToArea) return false;
      if (activeFilter === 'pending' && !pendingPhotos.some((pending) => pending.id === photo.id)) return false;
      if (activeFilter === 'not_started' && !isNotStarted(photo)) return false;
      if (activeFilter !== 'all' && activeFilter !== 'pending' && activeFilter !== 'not_started' && type !== activeFilter) return false;
      if (!query) return true;
      return [photo.name, photo.cameraCode, photo.tramo, photo.location, photo.metraje]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [activeFilter, pendingPhotos, photos, searchQuery, selectedPlanArea]);

  const positionedPhotos = useMemo(
    () => visiblePhotos.filter((photo) => isPlaced(photo)),
    [visiblePhotos],
  );
  const hoveredPlanPhoto = useMemo(
    () => positionedPhotos.find((photo) => photo.id === hoveredPlanPhotoId) || null,
    [hoveredPlanPhotoId, positionedPhotos],
  );

  const electricalOptionsForArea = useMemo(
    () => ELECTRICAL_ELEMENT_OPTIONS.filter((option) => option.value === 'cableado' || getElectricalPlanArea(option.value) === selectedPlanArea),
    [selectedPlanArea],
  );

  const totalPipelineMeters = useMemo(
    () => photos
      .filter((photo) => getElementType(photo) === 'tuberia')
      .reduce((total, photo) => total + (Number.parseFloat(String(photo.metraje ?? 0)) || 0), 0),
    [photos],
  );

  const selectedPlanPhoto = useMemo(
    () => photos.find((photo) => photo.id === selectedPlanPhotoId) ?? null,
    [photos, selectedPlanPhotoId],
  );

  const selectedMultiplePlanPhotos = useMemo(
    () => photos.filter((photo) => selectedPlanPhotoIds.includes(photo.id)),
    [photos, selectedPlanPhotoIds],
  );

  const exitMultipleSelection = () => {
    setIsMultipleSelectionMode(false);
    setSelectedPlanPhotoIds([]);
  };

  const requestReturnToAreas = () => {
    const hasInProgressWork = Boolean(placement || creationMode || pipeStart || calibrationMode || calibrationDraft);
    if (hasPendingPlanChanges || hasInProgressWork) {
      setIsLeaveConfirmOpen(true);
      return;
    }
    setSelectedPlanArea(null);
  };

  const switchPlanArea = (area: typeof QUICK_PLAN_AREAS[number]) => {
    if (selectedPlanArea === area) return;
    setPlacement(null);
    setCreationMode(null);
    setPipeStart(null);
    setPipePreview(null);
    setCalibrationMode(false);
    setCalibrationStart(null);
    setCalibrationPreview(null);
    setCalibrationDraft(null);
    setSelectedPlanPhotoId(null);
    exitMultipleSelection();
    setSearchQuery('');
    setSelectedPlanArea(area);
  };

  const confirmReturnToAreas = () => {
    setIsLeaveConfirmOpen(false);
    setPlacement(null);
    setCreationMode(null);
    setPipeStart(null);
    setPipePreview(null);
    setCalibrationMode(false);
    setCalibrationStart(null);
    setCalibrationPreview(null);
    setCalibrationDraft(null);
    setHasPendingPlanChanges(false);
    setSelectedPlanArea(null);
  };

  const toggleMultipleSelectionMode = () => {
    if (isMultipleSelectionMode) {
      exitMultipleSelection();
      return;
    }
    setPlacement(null);
    setCreationMode(null);
    setPipeStart(null);
    setPipePreview(null);
    setSelectedPlanPhotoId(null);
    setIsMultipleSelectionMode(true);
  };

  const togglePlanPhotoSelection = (photoId: string) => {
    setSelectedPlanPhotoIds((previous) => (
      previous.includes(photoId)
        ? previous.filter((id) => id !== photoId)
        : [...previous, photoId]
    ));
  };

  const selectAllPositioned = () => {
    setSelectedPlanPhotoIds(positionedPhotos.map((p) => p.id));
  };

  const selectCamerasOnly = () => {
    setSelectedPlanPhotoIds(
      positionedPhotos.filter((p) => getElementType(p) === 'camara').map((p) => p.id),
    );
  };

  const selectPipesOnly = () => {
    setSelectedPlanPhotoIds(
      positionedPhotos.filter((p) => getElementType(p) === 'tuberia').map((p) => p.id),
    );
  };

  const selectElectricalOnly = () => {
    setSelectedPlanPhotoIds(
      positionedPhotos
        .filter((p) => getElementType(p) === 'electrico' || isCable(p))
        .map((p) => p.id),
    );
  };

  const invertSelection = () => {
    const currentSet = new Set(selectedPlanPhotoIds);
    setSelectedPlanPhotoIds(
      positionedPhotos.filter((p) => !currentSet.has(p.id)).map((p) => p.id),
    );
  };

  const activateCreation = (elementType: CreationMode) => {
    setIsHandToolActive(false);
    exitMultipleSelection();
    setPlacement(null);
    setSelectedPlanPhotoId(null);
    setPipeStart(null);
    setPipePreview(null);
    if (elementType !== 'tuberia') setPipeAlignment('libre');
    setCreationMode((previous) => (previous === elementType ? null : elementType));
  };

  const selectForPlacement = (photo: InspectionPhoto) => {
    const type = getElementType(photo);
    if (type === 'tuberia') {
      setPlacement({ photo, stage: isPlaced(photo) ? 'pipe-end' : 'pipe-start' });
    } else {
      setPlacement({ photo, stage: 'point' });
    }
    setIsPanelOpen(false);
  };

  const startCalibration = () => {
    if (!isAdmin) {
      setBlueprintStorageNotice('La calibración del plano está disponible únicamente para el administrador.');
      return;
    }
    if (!blueprint.imageUrl) {
      setBlueprintStorageNotice('Carga primero el plano JPG para poder calibrarlo.');
      return;
    }
    setIsHandToolActive(false);
    exitMultipleSelection();
    setPlacement(null);
    setCreationMode(null);
    setPipeStart(null);
    setPipePreview(null);
    setSelectedPlanPhotoId(null);
    setCalibrationDraft(null);
    setCalibrationPreview(null);
    setCalibrationStart(null);
    setCalibrationMode(true);
  };

  const cancelCalibration = () => {
    setCalibrationMode(false);
    setCalibrationStart(null);
    setCalibrationPreview(null);
    setCalibrationDraft(null);
    setIsCalibrationDialogOpen(false);
  };

  const getCalibratedMeters = (
    position: Pick<InspectionPhoto, 'planX' | 'planY' | 'planEndX' | 'planEndY'>,
    calibration = blueprint.calibration,
  ) => {
    if (
      typeof position.planX !== 'number'
      || typeof position.planY !== 'number'
      || typeof position.planEndX !== 'number'
      || typeof position.planEndY !== 'number'
    ) return null;
    return getMetersFromPlanPoints(
      { planX: position.planX, planY: position.planY },
      { planX: position.planEndX, planY: position.planEndY },
      calibration,
    );
  };

  const updatePipeGeometry = (
    photo: InspectionPhoto,
    changes: Partial<Pick<InspectionPhoto, 'planX' | 'planY' | 'planEndX' | 'planEndY'>>,
    options: { recordHistory?: boolean } = {},
  ) => {
    if (getElementType(photo) !== 'tuberia' || !hasCompletePipe(photo)) return;
    setHasPendingPlanChanges(true);
    const before: PipeGeometry = {
      planX: photo.planX!,
      planY: photo.planY!,
      planEndX: photo.planEndX!,
      planEndY: photo.planEndY!,
    };
    const position = {
      planX: clampPercent(changes.planX ?? photo.planX!),
      planY: clampPercent(changes.planY ?? photo.planY!),
      planEndX: clampPercent(changes.planEndX ?? photo.planEndX!),
      planEndY: clampPercent(changes.planEndY ?? photo.planEndY!),
    };
    const hasGeometryChanged = Object.keys(before).some((key) => before[key as keyof PipeGeometry] !== position[key as keyof PipeGeometry]);
    if (options.recordHistory !== false && hasGeometryChanged) {
      const entry: PipeDimensionHistoryEntry = { photoId: photo.id, before, after: position };
      setPipeDimensionUndoStack((previous) => [...previous.slice(-19), entry]);
      setPipeDimensionRedoStack([]);
    }
    const metraje = getCalibratedMeters(position);
    onUpdatePhotoPosition(photo.id, {
      ...position,
      ...(metraje !== null ? { metraje: roundMeters(metraje) } : {}),
    });
  };

  const adjustPipeLength = (photo: InspectionPhoto, factor: number) => {
    if (!hasCompletePipe(photo) || factor <= 0) return;
    updatePipeGeometry(photo, {
      planEndX: photo.planX! + (photo.planEndX! - photo.planX!) * factor,
      planEndY: photo.planY! + (photo.planEndY! - photo.planY!) * factor,
    });
  };

  const getPipeDimensionAdjustment = () => {
    const parsed = Number.parseFloat(pipeDimensionPercent.replace(',', '.'));
    return clampScale(Number.isFinite(parsed) ? parsed : 10, 1, 75) / 100;
  };

  const undoPipeDimension = () => {
    const entry = pipeDimensionUndoStack.at(-1);
    if (!entry) return;
    const photo = photos.find((item) => item.id === entry.photoId);
    if (!photo) return;
    setPipeDimensionUndoStack((previous) => previous.slice(0, -1));
    setPipeDimensionRedoStack((previous) => [...previous.slice(-19), entry]);
    updatePipeGeometry(photo, entry.before, { recordHistory: false });
  };

  const redoPipeDimension = () => {
    const entry = pipeDimensionRedoStack.at(-1);
    if (!entry) return;
    const photo = photos.find((item) => item.id === entry.photoId);
    if (!photo) return;
    setPipeDimensionRedoStack((previous) => previous.slice(0, -1));
    setPipeDimensionUndoStack((previous) => [...previous.slice(-19), entry]);
    updatePipeGeometry(photo, entry.after, { recordHistory: false });
  };

  const saveCalibration = (event: React.FormEvent) => {
    event.preventDefault();
    if (!calibrationDraft) return;
    const referenceDistanceMeters = Number.parseFloat(calibrationMeters.replace(',', '.'));
    if (!Number.isFinite(referenceDistanceMeters) || referenceDistanceMeters <= 0) {
      setBlueprintStorageNotice('Indica una distancia conocida mayor que cero en metros.');
      return;
    }

    const calibration: BlueprintCalibration = {
      referenceDistanceMeters,
      referenceDistancePlanUnits: calibrationDraft.referenceDistancePlanUnits,
      aspectRatio: calibrationDraft.aspectRatio,
      calibratedAt: new Date().toISOString(),
    };
    setHasPendingPlanChanges(true);
    setBlueprint((previous) => ({ ...previous, calibration }));

    const measurements = photos
      .filter((photo) => getElementType(photo) === 'tuberia' && hasCompletePipe(photo))
      .map((photo) => {
        const meters = getMetersFromPlanPoints(
          { planX: photo.planX!, planY: photo.planY! },
          { planX: photo.planEndX!, planY: photo.planEndY! },
          calibration,
        );
        return { id: photo.id, metraje: roundMeters(meters ?? 0) };
      });
    if (measurements.length) onUpdatePipelineMeasurements(measurements);

    setBlueprintStorageNotice(
      `Plano calibrado: ${referenceDistanceMeters.toLocaleString('es-CO', { maximumFractionDigits: 2 })} m en el tramo de referencia.`,
    );
    cancelCalibration();
  };

  const handleBlueprintUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg'].includes(file.type)) {
      setBlueprintStorageNotice('Carga un plano en formato JPG o JPEG.');
      return;
    }

    setBlueprintStorageNotice('Optimizando el plano JPG…');
    try {
      const optimizedImage = await compressImageForDevice(file, 2400, 1800, 0.86);
      setBlueprint((previous) => ({
        ...previous,
        name: file.name.replace(/\.[^/.]+$/, ''),
        imageUrl: optimizedImage,
        visible: true,
        opacity: 1,
      }));
      setHasPendingPlanChanges(true);
      event.target.value = '';
      try {
        const remoteUrl = await uploadBlueprintToSupabase(optimizedImage, {
          id: inspector.id,
          name: inspector.name || inspector.email || 'Administrador',
        });
        const uploadedAt = new Date().toISOString();
        if (remoteUrl) {
          setBlueprintRevision({
            url: remoteUrl,
            updatedAt: uploadedAt,
            updatedByName: inspector.name || inspector.email || 'Administrador',
            version: uploadedAt,
          });
        }
        setBlueprintStorageNotice('Plano JPG sincronizado con Supabase Storage y disponible para inspectores.');
      } catch (error) {
        setBlueprintStorageNotice('El plano quedó guardado en este dispositivo, pero no se pudo sincronizar con Supabase Storage.');
        console.warn('No se pudo cargar el plano a Supabase Storage:', error);
      }
    } catch {
      setBlueprintStorageNotice('No se pudo procesar el JPG. Intenta con otro archivo de plano.');
    }
  };

  const getPlanPosition = (bounds: DOMRect, clientX: number, clientY: number) => ({
    planX: clampPercent(((clientX - bounds.left) / bounds.width) * 100),
    planY: clampPercent(((clientY - bounds.top) / bounds.height) * 100),
  });

  const placeTargetAt = (target: PlacementTarget, planX: number, planY: number) => {
    setHasPendingPlanChanges(true);
    if (target.stage === 'pipe-start') {
      onUpdatePhotoPosition(target.photo.id, {
        planX,
        planY,
        planEndX: undefined,
        planEndY: undefined,
      });
      setPlacement({ photo: { ...target.photo, planX, planY }, stage: 'pipe-end' });
      return;
    }

    if (target.stage === 'pipe-end') {
      const alignedEnd = alignPipeEnd(
        { planX: target.photo.planX!, planY: target.photo.planY! },
        { planX, planY },
        pipeAlignment,
      );
      const position = { planX: target.photo.planX, planY: target.photo.planY, planEndX: alignedEnd.planX, planEndY: alignedEnd.planY };
      const metraje = getCalibratedMeters(position);
      onUpdatePhotoPosition(target.photo.id, {
        planEndX: alignedEnd.planX,
        planEndY: alignedEnd.planY,
        ...(metraje !== null ? { metraje: roundMeters(metraje) } : {}),
      });
      setPlacement(null);
      return;
    }

    onUpdatePhotoPosition(target.photo.id, { planX, planY });
    setPlacement(null);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdmin) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const { planX, planY } = getPlanPosition(bounds, event.clientX, event.clientY);

    if (isMultipleSelectionMode) {
      setSelectedPlanPhotoIds([]);
      return;
    }

    if (calibrationMode) {
      if (!calibrationStart) {
        setCalibrationStart({ planX, planY });
        return;
      }
      const referenceDistancePlanUnits = getPlanDistanceUnits(
        calibrationStart,
        { planX, planY },
        bounds.width / bounds.height,
      );
      if (referenceDistancePlanUnits <= 0) return;
      setCalibrationDraft({
        referenceDistancePlanUnits,
        referenceDistancePercent: getPercentDistance(calibrationStart, { planX, planY }),
        aspectRatio: bounds.width / bounds.height,
      });
      setCalibrationMode(false);
      setCalibrationStart(null);
      setCalibrationPreview(null);
      setIsCalibrationDialogOpen(true);
      return;
    }

    if (creationMode === 'camara' || creationMode === 'caja') {
      const created = onCreatePhoto(creationMode, { planX, planY });
      setHasPendingPlanChanges(true);
      setActiveFilter('all');
      setSelectedPlanPhotoId(created.id);
      setCreationMode(null);
      return;
    }

    const electricalCreationType = isElectricalElementType(creationMode ?? undefined)
      ? creationMode as ElectricalElementType
      : undefined;

    if (electricalCreationType === 'cableado') {
      if (!pipeStart) {
        setPipeStart({ planX, planY });
        return;
      }
      const alignedEnd = alignPipeEnd(pipeStart, { planX, planY }, pipeAlignment);
      const created = onCreatePhoto('electrico', {
        planX: pipeStart.planX,
        planY: pipeStart.planY,
        planEndX: alignedEnd.planX,
        planEndY: alignedEnd.planY,
      }, roundMeters(getMetersFromPlanPoints(pipeStart, alignedEnd, blueprint.calibration) ?? 0), 'cableado', selectedPlanArea ?? undefined);
      setHasPendingPlanChanges(true);
      setActiveFilter('all');
      setSelectedPlanPhotoId(created.id);
      setPipeStart(null);
      setPipePreview(null);
      setPipeAlignment('libre');
      setCreationMode(null);
      return;
    }

    if (electricalCreationType) {
      const created = onCreatePhoto('electrico', { planX, planY }, undefined, electricalCreationType, selectedPlanArea ?? undefined);
      setHasPendingPlanChanges(true);
      setSelectedPlanPhotoId(created.id);
      setCreationMode(null);
      return;
    }

    if (creationMode === 'tuberia') {
      if (!pipeStart) {
        setPipeStart({ planX, planY });
        return;
      }
      const alignedEnd = alignPipeEnd(pipeStart, { planX, planY }, pipeAlignment);
      const created = onCreatePhoto('tuberia', {
        planX: pipeStart.planX,
        planY: pipeStart.planY,
        planEndX: alignedEnd.planX,
        planEndY: alignedEnd.planY,
      }, roundMeters(getMetersFromPlanPoints(pipeStart, alignedEnd, blueprint.calibration) ?? 0));
      setHasPendingPlanChanges(true);
      setActiveFilter('all');
      setSelectedPlanPhotoId(created.id);
      setPipeStart(null);
      setPipePreview(null);
      setPipeAlignment('libre');
      setCreationMode(null);
      return;
    }

    if (!placement) return;
    placeTargetAt(placement, planX, planY);
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    if (calibrationMode && calibrationStart) {
      setCalibrationPreview(getPlanPosition(bounds, event.clientX, event.clientY));
      return;
    }
    if ((creationMode !== 'tuberia' && creationMode !== 'cableado') || !pipeStart) return;
    setPipePreview(alignPipeEnd(pipeStart, getPlanPosition(bounds, event.clientX, event.clientY), pipeAlignment));
  };

  const handleCanvasMouseLeave = () => {
    if (creationMode === 'tuberia' || creationMode === 'cableado') setPipePreview(null);
    if (calibrationMode) setCalibrationPreview(null);
  };

  const startPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y,
    };
  };

  const movePanning = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current;
    if (!start) return;
    setPanOffset({
      x: start.offsetX + event.clientX - start.clientX,
      y: start.offsetY + event.clientY - start.clientY,
    });
  };

  const stopPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panStartRef.current = null;
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isAdmin) return;
    event.preventDefault();
    const activeDrag = dragTargetRef.current ?? dragTarget;
    if (!activeDrag) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const { planX, planY } = getPlanPosition(bounds, event.clientX, event.clientY);
    const { photo, source } = activeDrag;
    const type = getElementType(photo);
    const isLongitudinalElement = type === 'tuberia' || isCable(photo);

    if (source === 'palette') {
      setHasPendingPlanChanges(true);
      placeTargetAt(
        { photo, stage: isLongitudinalElement ? (isPlaced(photo) ? 'pipe-end' : 'pipe-start') : 'point' },
        planX,
        planY,
      );
    } else if (isLongitudinalElement && hasCompletePipe(photo)) {
      setHasPendingPlanChanges(true);
      const midpointX = (photo.planX! + photo.planEndX!) / 2;
      const midpointY = (photo.planY! + photo.planEndY!) / 2;
      const shiftX = Math.min(100 - Math.max(photo.planX!, photo.planEndX!), Math.max(-Math.min(photo.planX!, photo.planEndX!), planX - midpointX));
      const shiftY = Math.min(100 - Math.max(photo.planY!, photo.planEndY!), Math.max(-Math.min(photo.planY!, photo.planEndY!), planY - midpointY));
      const position = {
        planX: photo.planX! + shiftX,
        planY: photo.planY! + shiftY,
        planEndX: photo.planEndX! + shiftX,
        planEndY: photo.planEndY! + shiftY,
      };
      const metraje = getCalibratedMeters(position);
      onUpdatePhotoPosition(photo.id, {
        ...position,
        ...(metraje !== null ? { metraje: roundMeters(metraje) } : {}),
        ...(isCable(photo) && metraje !== null ? { cableMeters: roundMeters(metraje) } : {}),
      });
    } else {
      setHasPendingPlanChanges(true);
      onUpdatePhotoPosition(photo.id, { planX, planY });
    }
    dragTargetRef.current = null;
    setDragTarget(null);
  };

  const startDragging = (event: React.DragEvent<HTMLElement>, photo: InspectionPhoto, source: DragTarget['source']) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', photo.id);
    const target = { photo, source } satisfies DragTarget;
    dragTargetRef.current = target;
    setDragTarget(target);
  };

  const planScale = clampScale(Number(blueprint.scale) || 1, 0.45, 8);
  const adjustPlanScale = (difference: number) => {
    setBlueprint((previous) => ({
      ...previous,
      scale: clampScale((Number(previous.scale) || 1) + difference, 0.45, 8),
    }));
  };
  const adjustIconScale = (difference: number) => {
    setIconScale((previous) => clampScale(previous + difference, 0.2, 1.8));
  };
  const adjustTextScale = (difference: number) => {
    setTextScale((previous) => clampScale(previous + difference, 0.25, 1.8));
  };

  const pipePreviewDistance = useMemo(() => {
    if (!pipeStart || !pipePreview) return null;
    return getPercentDistance(pipeStart, pipePreview);
  }, [pipePreview, pipeStart]);

  const pipePreviewMeters = useMemo(() => {
    if (!pipeStart || !pipePreview) return null;
    return getMetersFromPlanPoints(pipeStart, pipePreview, blueprint.calibration);
  }, [blueprint.calibration, pipePreview, pipeStart]);

  const pipePreviewMidpoint = pipeStart && pipePreview
    ? { planX: (pipeStart.planX + pipePreview.planX) / 2, planY: (pipeStart.planY + pipePreview.planY) / 2 }
    : null;

  const calibrationPreviewDistance = calibrationStart && calibrationPreview
    ? getPercentDistance(calibrationStart, calibrationPreview)
    : null;
  const calibrationPreviewMidpoint = calibrationStart && calibrationPreview
    ? { planX: (calibrationStart.planX + calibrationPreview.planX) / 2, planY: (calibrationStart.planY + calibrationPreview.planY) / 2 }
    : null;

  const placementInstruction = calibrationMode
    ? calibrationStart
      ? 'Marca el final de un tramo cuya distancia real conozcas.'
      : 'Marca el inicio de un tramo con distancia conocida para calibrar el plano.'
    : creationMode === 'camara'
    ? 'Haz clic sobre el plano para agregar una nueva cámara.'
    : creationMode === 'caja'
      ? 'Haz clic sobre el plano para agregar una nueva caja.'
    : creationMode === 'tuberia'
      ? pipeStart
        ? `Haz clic para definir el final del nuevo tramo. Guía actual: ${pipePreviewMeters !== null ? `${pipePreviewMeters.toFixed(2)} m` : `${pipePreviewDistance?.toFixed(1) ?? '0.0'}% del plano`}.`
        : 'Haz clic para definir el inicio del nuevo tramo de tubería.'
      : creationMode === 'cableado'
        ? pipeStart
          ? `Haz clic para definir el final del cableado. Guía actual: ${pipePreviewMeters !== null ? `${pipePreviewMeters.toFixed(2)} m` : `${pipePreviewDistance?.toFixed(1) ?? '0.0'}% del plano`}.`
          : 'Haz clic para definir el inicio del tramo de cableado.'
      : placement
    ? placement.stage === 'pipe-start'
      ? `Haz clic para ubicar el inicio de ${elementLabel(placement.photo)}.`
      : placement.stage === 'pipe-end'
        ? `Haz clic para ubicar el final de ${elementLabel(placement.photo)}.`
        : `Haz clic para ubicar ${elementLabel(placement.photo)}.`
    : null;

  const activeAreaDetails = selectedPlanArea && selectedPlanArea !== 'electrical'
    ? PLAN_AREA_DETAILS[selectedPlanArea]
    : PLAN_AREA_DETAILS.electrical_mt;

  if (!selectedPlanArea) {
    const civilCount = photos.filter((photo) => !isElectricalPhoto(photo)).length;
    const electricalMtCount = photos.filter((photo) => getPhotoPlanArea(photo) === 'electrical_mt').length;
    const electricalLightingCount = photos.filter((photo) => getPhotoPlanArea(photo) === 'electrical_lighting').length;
    return (
      <section className="flex h-full min-h-[560px] w-full items-center justify-center overflow-auto bg-[#e7edf1] p-5 font-['Roboto',sans-serif]">
        <div className="w-full max-w-5xl">
          <div className="mb-6 text-center">
            <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-[#527284]">PLANO DE OBRA / ÁREA TÉCNICA</p>
            <h1 className="mt-2 text-2xl font-bold text-[#0b2940] sm:text-3xl">Selecciona el área de actualización</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#547181]">Todas las áreas usan el mismo plano JPG como base, pero sus elementos se guardan y visualizan de forma independiente.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <button
              type="button"
              onClick={() => switchPlanArea('civil')}
              className="group overflow-hidden border border-[#9bc4d8] bg-white text-left shadow-[0_16px_34px_rgba(7,63,116,0.14)] transition hover:-translate-y-1 hover:border-[#0566aa] hover:shadow-[0_20px_42px_rgba(7,63,116,0.2)] rounded-xl"
            >
              <div className="flex items-center justify-between bg-[#eaf6fb] px-5 py-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0566aa] text-white shadow-sm"><span className="material-symbols-outlined text-[26px]">architecture</span></span>
                <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-[#075a91]">CAPA 01 / CIVIL</span>
              </div>
              <div className="p-5">
                <h2 className="text-xl font-bold text-[#0b2940]">Obras Civiles</h2>
                <p className="mt-2 text-sm leading-6 text-[#547181]">Cámaras, cajas, tramos y canalizaciones que componen la capa civil del proyecto.</p>
                <div className="mt-5 flex items-center justify-between border-t border-[#d6e5ec] pt-4">
                  <span className="text-xs font-bold text-[#075a91]">{civilCount} elemento{civilCount === 1 ? '' : 's'}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-[#0566aa]">Abrir plano <span className="material-symbols-outlined text-[18px]">arrow_forward</span></span>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => switchPlanArea('electrical_mt')}
              className="group overflow-hidden border border-[#ceb9f3] bg-white text-left shadow-[0_16px_34px_rgba(91,33,182,0.13)] transition hover:-translate-y-1 hover:border-[#7c3aed] hover:shadow-[0_20px_42px_rgba(91,33,182,0.2)] rounded-xl"
            >
              <div className="flex items-center justify-between bg-[#f4efff] px-5 py-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6d28d9] text-white shadow-sm"><span className="material-symbols-outlined text-[26px]">bolt</span></span>
                <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-[#5b21b6]">CAPA 02 / ELÉCTRICA MT</span>
              </div>
              <div className="p-5">
                <h2 className="text-xl font-bold text-[#3b1b75]">Obras Eléctricas MT</h2>
                <p className="mt-2 text-sm leading-6 text-[#6b5a85]">Transformadores, barrajes, postes MT, reconectadores, tableros de distribución y mallas a tierra.</p>
                <div className="mt-5 flex items-center justify-between border-t border-[#e4d9f6] pt-4">
                  <span className="text-xs font-bold text-[#6d28d9]">{electricalMtCount} elemento{electricalMtCount === 1 ? '' : 's'}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-[#6d28d9]">Abrir plano <span className="material-symbols-outlined text-[18px]">arrow_forward</span></span>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => switchPlanArea('electrical_lighting')}
              className="group overflow-hidden border border-[#ead28c] bg-white text-left shadow-[0_16px_34px_rgba(202,138,4,0.13)] transition hover:-translate-y-1 hover:border-[#ca8a04] hover:shadow-[0_20px_42px_rgba(202,138,4,0.2)] rounded-xl"
            >
              <div className="flex items-center justify-between bg-[#fff8e5] px-5 py-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ca8a04] text-white shadow-sm"><span className="material-symbols-outlined text-[26px]">light</span></span>
                <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-[#a16207]">CAPA 03 / ALUMBRADO</span>
              </div>
              <div className="p-5">
                <h2 className="text-xl font-bold text-[#854d0e]">Obras Eléctricas Alumbrado</h2>
                <p className="mt-2 text-sm leading-6 text-[#7c6a45]">Postes, luminarias y activos de alumbrado vinculados al plano de obra.</p>
                <div className="mt-5 flex items-center justify-between border-t border-[#f1e2b6] pt-4">
                  <span className="text-xs font-bold text-[#a16207]">{electricalLightingCount} elemento{electricalLightingCount === 1 ? '' : 's'}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-[#a16207]">Abrir plano <span className="material-symbols-outlined text-[18px]">arrow_forward</span></span>
                </div>
              </div>
            </button>
          </div>
          <p className="mt-5 text-center text-xs text-[#6a8390]">Plano JPG compartido: {blueprint.imageUrl ? blueprint.name : 'aún no cargado'}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`relative flex h-full w-full flex-col overflow-hidden bg-[#e7edf1] font-['Roboto',sans-serif] ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#e7edf1]' : ''
      }`}
    >
      {blueprintStorageNotice && (
        <div className="absolute right-4 top-20 z-50 flex max-w-sm items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 shadow-lg">
          <span className="material-symbols-outlined mt-0.5 text-[17px] text-amber-700">info</span>
          <span className="flex-1">{blueprintStorageNotice}</span>
          <button type="button" onClick={() => setBlueprintStorageNotice(null)} aria-label="Cerrar aviso">
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>
      )}
      {blueprintUpdateNotice && !isAdmin && (
        <div role="status" className="absolute right-4 top-20 z-50 flex max-w-sm items-start gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2.5 text-xs text-cyan-950 shadow-lg motion-safe:animate-[pulse_900ms_ease-out_1]">
          <span className="material-symbols-outlined mt-0.5 text-[17px] text-cyan-700">cloud_done</span>
          <span className="flex-1 font-medium">{blueprintUpdateNotice}</span>
          <button type="button" onClick={() => setBlueprintUpdateNotice(null)} aria-label="Cerrar aviso de plano actualizado">
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>
      )}

      <header className="relative z-30 flex shrink-0 flex-col gap-3 border-b border-[#c7d7df] bg-white/95 px-4 py-3 shadow-sm backdrop-blur xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: activeAreaDetails.color }}>
            <span className="material-symbols-outlined text-[21px]">{activeAreaDetails.icon}</span>
          </div>
          <div className="min-w-0">
            <Breadcrumb className="mb-1">
              <BreadcrumbList className="gap-1 text-[10px] font-bold tracking-[0.1em]" style={{ color: activeAreaDetails.color }}>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      onClick={requestReturnToAreas}
                      className="inline-flex items-center gap-1 rounded-sm font-mono uppercase underline decoration-1 underline-offset-4 transition hover:text-[#0566aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0566aa] focus-visible:ring-offset-2"
                      aria-label="Volver al menú principal de áreas de planos"
                      title="Volver al menú principal de áreas"
                    >
                      <span className="material-symbols-outlined text-[13px]">home</span>
                      Planos de obra
                    </button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#86a0ad]" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-mono text-[10px] font-bold tracking-[0.1em]" style={{ color: activeAreaDetails.color }}>
                    {activeAreaDetails.label}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="truncate text-sm font-bold text-[#0b2940]">{blueprint.imageUrl ? blueprint.name : 'Carga un plano JPG para comenzar'}</h1>
            {blueprintRevision && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#527284]">
                <span className="inline-flex items-center gap-1 font-semibold text-[#0566aa]"><span className="material-symbols-outlined text-[13px]">history</span>Última modificación</span>
                <span>{blueprintSyncPresentation.lastModifiedLabel}</span>
                <span className="text-[#aabcc6]">•</span>
                <span>Por: <strong className="font-semibold text-[#24485b]">{blueprintSyncPresentation.authorLabel}</strong></span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:flex-none">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#5d7887]">search</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar elementos…"
              className="h-9 w-full rounded-lg border border-[#c7d7df] bg-white py-1 pl-9 pr-3 text-xs text-[#0b2940] outline-none transition focus:border-[#0566aa] focus:ring-2 focus:ring-[#0566aa]/15"
            />
          </div>
          <button
            type="button"
            onClick={requestReturnToAreas}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#b4cbd8] bg-white px-3 text-xs font-semibold text-[#154860] transition hover:bg-[#eaf6fb]"
          >
            <span className="material-symbols-outlined text-[17px]">arrow_back</span>
            Volver
          </button>
          {isAdmin && <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#b4cbd8] bg-white px-3 text-xs font-semibold text-[#154860] transition hover:bg-[#eaf6fb]"
          >
            <span className="material-symbols-outlined text-[17px]">format_list_bulleted</span>
            Ubicar ({pendingPhotos.length})
          </button>}
          {isAdmin && <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0566aa] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#004d84]"
          >
            <span className="material-symbols-outlined text-[17px]">upload_file</span>
            {blueprint.imageUrl ? 'Cambiar JPG' : 'Cargar JPG'}
          </button>}
          {isAdmin && <input ref={fileInputRef} type="file" accept="image/jpeg,.jpg,.jpeg" onChange={handleBlueprintUpload} className="hidden" />}
        </div>
      </header>

      <div className="relative z-20 shrink-0 overflow-x-auto border-b border-[#c7d7df] bg-[#f7fbfd]/95 px-4 py-2 shadow-sm">
      <div className="flex min-w-max items-center gap-2 pr-4">
        <div className="mr-1 inline-flex items-center gap-1 rounded-lg border border-[#b9d0db] bg-white p-1 shadow-xs" aria-label="Acceso rápido a capas de obra" role="group">
          <span className="px-1.5 font-mono text-[9px] font-bold tracking-[0.12em] text-[#66808d]">CAPAS</span>
          {QUICK_PLAN_AREAS.map((area) => {
            const details = PLAN_AREA_DETAILS[area];
            const isActive = selectedPlanArea === area;
            return (
              <button
                key={area}
                type="button"
                onClick={() => switchPlanArea(area)}
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0566aa] focus-visible:ring-offset-1 ${isActive ? 'text-white shadow-sm' : 'border-transparent bg-[#f4f9fb] text-[#466473] hover:bg-[#e5f4fb]'}`}
                style={isActive ? { backgroundColor: details.color, borderColor: details.color } : undefined}
                aria-pressed={isActive}
                title={`Cambiar a ${details.label}: ${elementCountByPlanArea[area]} elementos guardados`}
              >
                <span className="material-symbols-outlined text-[14px]">{details.icon}</span>
                {details.shortLabel}
                <span className={`ml-0.5 inline-grid min-w-4 place-items-center rounded-full px-1 py-0.5 font-mono text-[9px] leading-none ${isActive ? 'bg-white/20 text-white' : 'bg-[#dbeaf1] text-[#315364]'}`} aria-label={`${elementCountByPlanArea[area]} elementos guardados`}>
                  {elementCountByPlanArea[area]}
                </span>
              </button>
            );
          })}
        </div>
        <span className="hidden h-6 w-px bg-[#b8ced9] sm:block" aria-hidden="true" />
        {(selectedPlanArea !== 'civil'
          ? [['all', 'Todos', 'bolt'], ['not_started', 'No iniciado', 'schedule'], ['pending', 'Sin ubicar', 'location_off']]
          : [['all', 'Todos', 'layers'], ['camara', 'Cámaras', 'videocam'], ['caja', 'Cajas', 'inventory_2'], ['tuberia', 'Tuberías', 'timeline'], ['not_started', 'No iniciado', 'schedule'], ['pending', 'Sin ubicar', 'location_off']]
        ).map(([filter, label, icon]) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter as PlanFilter)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${
              activeFilter === filter
                ? filter === 'not_started' ? 'border-[#64748b] bg-[#eef2f7] text-[#334155]' : 'border-[#0566aa] bg-[#e5f4fb] text-[#004d84]'
                : 'border-[#c7d7df] bg-white text-[#466473] hover:bg-[#f4fafc]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">{icon}</span>
            {label}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-[#b8ced9] sm:block" aria-hidden="true" />
        {isAdmin && (selectedPlanArea === 'civil' ? (
          <>
            <button type="button" onClick={() => activateCreation('caja')} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${creationMode === 'caja' ? 'border-[#b77812] bg-[#b77812] text-white' : 'border-[#e0bf78] bg-white text-[#8b5d05] hover:bg-[#fff6df]'}`} title="Agregar caja directamente al plano"><span className="material-symbols-outlined text-[16px]">inventory_2</span>Caja</button>
            <button type="button" onClick={() => activateCreation('camara')} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${creationMode === 'camara' ? 'border-[#0566aa] bg-[#0566aa] text-white' : 'border-[#8ec6dd] bg-white text-[#075a91] hover:bg-[#e5f4fb]'}`} title="Agregar cámara directamente al plano"><span className="material-symbols-outlined text-[16px]">add_a_photo</span>Cámara</button>
            <button type="button" onClick={() => activateCreation('tuberia')} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${creationMode === 'tuberia' ? 'border-[#073f74] bg-[#073f74] text-white' : 'border-[#9fb5c5] bg-white text-[#173f58] hover:bg-[#eaf3f8]'}`} title="Agregar tramo de tubería directamente al plano"><span className="material-symbols-outlined text-[16px]">timeline</span>Tubería</button>
          </>
        ) : (
          electricalOptionsForArea.map((element) => (
            <button key={element.value} type="button" onClick={() => activateCreation(element.value)} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${creationMode === element.value ? 'border-[#5b21b6] bg-[#5b21b6] text-white' : 'border-[#d8c3fb] bg-white text-[#5b21b6] hover:bg-[#f5f0ff]'}`} title={`Agregar ${element.label.toLowerCase()} al plano eléctrico`}><span className="material-symbols-outlined text-[16px]">{element.icon}</span>{element.shortLabel}</button>
          ))
        ))}
        <button
          type="button"
          onClick={toggleMultipleSelectionMode}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${
            isMultipleSelectionMode
              ? 'border-[#004d99] bg-[#004d99] text-white shadow-xs'
              : 'border-[#9fb5c5] bg-white text-[#173f58] hover:bg-[#eaf3f8]'
          }`}
          title="Selección múltiple para ajustar propiedades en grupo o eliminar"
          aria-pressed={isMultipleSelectionMode}
        >
          <span className="material-symbols-outlined text-[16px]">select_all</span>
          Ajuste Grupal
        </button>
        <button
          type="button"
          onClick={() => setAreActaLabelsVisible((visible) => !visible)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${
            areActaLabelsVisible
              ? 'border-[#0b5d8c] bg-white text-[#075a91] hover:bg-[#e5f4fb]'
              : 'border-[#afc0c9] bg-[#eef3f5] text-[#58717d] hover:bg-white'
          }`}
          title={areActaLabelsVisible ? 'Ocultar todos los rótulos de acta' : 'Mostrar todos los rótulos de acta'}
          aria-pressed={areActaLabelsVisible}
        >
          <span className="material-symbols-outlined text-[16px]">{areActaLabelsVisible ? 'visibility' : 'visibility_off'}</span>
          Actas
        </button>
        <button
          type="button"
          onClick={() => setAreCameraNamesVisible((visible) => !visible)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${
            areCameraNamesVisible
              ? 'border-[#0b5d8c] bg-white text-[#075a91] hover:bg-[#e5f4fb]'
              : 'border-[#afc0c9] bg-[#eef3f5] text-[#58717d] hover:bg-white'
          }`}
          title={areCameraNamesVisible ? 'Ocultar nombres de cámaras' : 'Mostrar nombres de cámaras'}
          aria-pressed={areCameraNamesVisible}
        >
          <span className="material-symbols-outlined text-[16px]">{areCameraNamesVisible ? 'visibility' : 'visibility_off'}</span>
          Nombres
        </button>
        <button
          type="button"
          onClick={() => setArePipeNamesVisible((visible) => !visible)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-sm transition ${
            arePipeNamesVisible
              ? 'border-[#4f46e5] bg-white text-[#3730a3] hover:bg-indigo-50'
              : 'border-[#afc0c9] bg-[#eef3f5] text-[#58717d] hover:bg-white'
          }`}
          title={arePipeNamesVisible ? 'Ocultar nombres de tramos' : 'Mostrar nombres de tramos'}
          aria-pressed={arePipeNamesVisible}
        >
          <span className="material-symbols-outlined text-[16px]">{arePipeNamesVisible ? 'visibility' : 'visibility_off'}</span>
          Tramos
        </button>
      </div>
      </div>

      <main className="relative min-h-0 flex-1 overflow-auto p-5">
        {blueprintSyncPresentation.isLoading && (
          <div role="status" aria-live="polite" className="absolute inset-0 z-20 flex items-center justify-center bg-[#e7edf1]/80 backdrop-blur-[1px]">
            <div className="flex min-w-[250px] items-center gap-3 rounded-2xl border border-[#b6d4e4] bg-white/95 px-5 py-4 shadow-[0_16px_38px_rgba(7,63,116,0.16)]">
              <span className="material-symbols-outlined text-[28px] text-[#0566aa] motion-safe:animate-spin">sync</span>
              <div>
                <p className="text-sm font-bold text-[#0b2940]">Actualizando plano compartido</p>
                <p className="mt-0.5 text-xs text-[#527284]">Descargando la versión más reciente…</p>
              </div>
            </div>
          </div>
        )}
        {blueprint.imageUrl ? (
          <div className="flex min-h-full min-w-full items-center justify-center py-3">
            <div
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={handleCanvasDrop}
              className={`relative inline-flex max-h-[calc(100vh-15rem)] max-w-[calc(100vw-3rem)] overflow-hidden border border-[#9dbbc9] bg-white shadow-[0_18px_46px_rgba(7,63,116,0.22)] transition-transform duration-200 ${
                placement || creationMode ? 'cursor-crosshair' : dragTarget ? 'ring-2 ring-[#18a9cf] ring-offset-2' : 'cursor-default'
              }`}
              style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${planScale})` }}
              aria-label="Plano interactivo de inspección"
            >
              <img
                src={blueprint.imageUrl}
                alt={blueprint.name}
                className="block max-h-[calc(100vh-15rem)] max-w-[calc(100vw-3rem)] object-contain"
                draggable={false}
              />

              {isHandToolActive && (
                <div
                  className="absolute inset-0 z-30 touch-none cursor-grab active:cursor-grabbing"
                  onPointerDown={startPanning}
                  onPointerMove={movePanning}
                  onPointerUp={stopPanning}
                  onPointerCancel={stopPanning}
                  aria-label="Arrastra para mover el plano"
                  role="application"
                >
                  <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#073f74]/90 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                    <span className="material-symbols-outlined text-[14px]">pan_tool_alt</span>
                    Modo mano
                  </span>
                </div>
              )}

            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="plan-mt" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0d9fc6" />
                  <stop offset="100%" stopColor="#004d84" />
                </linearGradient>
                <linearGradient id="plan-bt" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              {positionedPhotos.map((photo) => {
                const pipeline = getElementType(photo) === 'tuberia';
                const cable = isCable(photo);
                if ((!pipeline && !cable) || !hasCompletePipe(photo)) return null;
                const pipeConduits = pipeline && photo.pipeConduits?.length
                  ? photo.pipeConduits
                  : pipeline ? [{
                    id: `legacy-${photo.id}`,
                    networkType: getPipeNetworkOption(photo.pipeNetworkType).value,
                    configuration: photo.tramo || '',
                    meters: photo.metraje ?? 0,
                  }] : [];
                const lineDeltaX = photo.planEndX! - photo.planX!;
                const lineDeltaY = photo.planEndY! - photo.planY!;
                const lineLength = Math.hypot(lineDeltaX, lineDeltaY) || 1;
                const parallelOffset = (index: number) => (index - (pipeConduits.length - 1) / 2) * 0.72;
                const offsetPoint = (x: number, y: number, offset: number) => ({
                  x: x + (-lineDeltaY / lineLength) * offset,
                  y: y + (lineDeltaX / lineLength) * offset,
                });
                const isSelected = isMultipleSelectionMode
                  ? selectedPlanPhotoIds.includes(photo.id)
                  : selectedPlanPhotoId === photo.id;
                return (
                  <g key={`line-${photo.id}`}>
                    {isSelected && (
                      <line
                        x1={photo.planX}
                        y1={photo.planY}
                        x2={photo.planEndX}
                        y2={photo.planEndY}
                        stroke="#0284c7"
                        strokeWidth="3.6"
                        strokeOpacity="0.85"
                        strokeLinecap="round"
                      />
                    )}
                    <line x1={photo.planX} y1={photo.planY} x2={photo.planEndX} y2={photo.planEndY} stroke="rgba(255,255,255,0.82)" strokeWidth="2.2" strokeLinecap="round" />
                    {cable && (
                      <line x1={photo.planX} y1={photo.planY} x2={photo.planEndX} y2={photo.planEndY} stroke={isNotStarted(photo) ? NO_STARTED_MARKER_COLOR : getCableTypeOption(photo.cableType).color} strokeWidth="1.35" strokeDasharray="1.1 0.8" strokeLinecap="round" />
                    )}
                    {pipeline && isNotStarted(photo) && (
                      <line x1={photo.planX} y1={photo.planY} x2={photo.planEndX} y2={photo.planEndY} stroke={NO_STARTED_MARKER_COLOR} strokeWidth="1.35" strokeLinecap="round" />
                    )}
                    {pipeline && !isNotStarted(photo) && pipeConduits.map((conduit, index) => {
                      const offset = parallelOffset(index);
                      const start = offsetPoint(photo.planX!, photo.planY!, offset);
                      const end = offsetPoint(photo.planEndX!, photo.planEndY!, offset);
                      return (
                        <line
                          key={conduit.id}
                          x1={start.x}
                          y1={start.y}
                          x2={end.x}
                          y2={end.y}
                          stroke={getPipeNetworkOption(conduit.networkType).color}
                          strokeWidth="1.35"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    {isSelected && (
                      <>
                        <circle cx={photo.planX} cy={photo.planY} r="1.6" fill="#ffffff" stroke="#0284c7" strokeWidth="0.8" />
                        <circle cx={photo.planEndX} cy={photo.planEndY} r="1.6" fill="#ffffff" stroke="#0284c7" strokeWidth="0.8" />
                      </>
                    )}
                    {/* Hit area for selecting lines via click */}
                    <line
                      x1={photo.planX}
                      y1={photo.planY}
                      x2={photo.planEndX}
                      y2={photo.planEndY}
                      stroke="transparent"
                      strokeWidth="5"
                      className={placement || creationMode ? 'pointer-events-none' : 'cursor-pointer'}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (placement || creationMode) return;
                        if (isMultipleSelectionMode) {
                          togglePlanPhotoSelection(photo.id);
                        } else {
                          setSelectedPlanPhotoId(photo.id);
                        }
                      }}
                    />
                  </g>
                );
              })}
              {(creationMode === 'tuberia' || creationMode === 'cableado') && pipeStart && (
                <>
                  {pipePreview && (
                    <>
                      <line x1={pipeStart.planX} y1={pipeStart.planY} x2={pipePreview.planX} y2={pipePreview.planY} stroke="rgba(255,255,255,0.92)" strokeWidth="2.8" strokeLinecap="round" />
                      <line x1={pipeStart.planX} y1={pipeStart.planY} x2={pipePreview.planX} y2={pipePreview.planY} stroke={creationMode === 'cableado' ? getCableTypeOption(selectedPlanArea === 'electrical_lighting' ? 'alumbrado' : selectedPlanArea === 'electrical_bt' ? 'baja_tension' : 'media_tension').color : '#073f74'} strokeWidth="1.3" strokeDasharray="2.2 1.4" strokeLinecap="round" />
                      <circle cx={pipePreview.planX} cy={pipePreview.planY} r="1.25" fill="#eab308" stroke="white" strokeWidth="0.65" />
                    </>
                  )}
                  <circle cx={pipeStart.planX} cy={pipeStart.planY} r="1.6" fill={creationMode === 'cableado' ? getCableTypeOption(selectedPlanArea === 'electrical_lighting' ? 'alumbrado' : selectedPlanArea === 'electrical_bt' ? 'baja_tension' : 'media_tension').color : '#073f74'} stroke="white" strokeWidth="0.7" />
                </>
              )}
              {calibrationMode && calibrationStart && (
                <>
                  {calibrationPreview && (
                    <>
                      <line x1={calibrationStart.planX} y1={calibrationStart.planY} x2={calibrationPreview.planX} y2={calibrationPreview.planY} stroke="rgba(255,255,255,0.95)" strokeWidth="3" strokeLinecap="round" />
                      <line x1={calibrationStart.planX} y1={calibrationStart.planY} x2={calibrationPreview.planX} y2={calibrationPreview.planY} stroke="#eab308" strokeWidth="1.4" strokeDasharray="1.8 1.2" strokeLinecap="round" />
                      <circle cx={calibrationPreview.planX} cy={calibrationPreview.planY} r="1.25" fill="#eab308" stroke="white" strokeWidth="0.65" />
                    </>
                  )}
                  <circle cx={calibrationStart.planX} cy={calibrationStart.planY} r="1.6" fill="#eab308" stroke="white" strokeWidth="0.7" />
                </>
              )}
            </svg>

            {pipePreviewDistance !== null && pipePreviewMidpoint && (
              <div
                className="pointer-events-none absolute z-20 rounded-full border border-[#f8d878] bg-[#0b2940]/95 px-2.5 py-1 font-mono text-[10px] font-bold text-white shadow-lg"
                style={{ left: `${pipePreviewMidpoint.planX}%`, top: `${pipePreviewMidpoint.planY}%`, transform: `translate(-50%, -50%) scale(${textScale})`, transformOrigin: 'center' }}
              >
                ↔ {pipePreviewDistance.toFixed(1)}% del plano
              </div>
            )}

            {pipePreviewMeters !== null && pipePreviewMidpoint && (
              <div
                className="pointer-events-none absolute z-20 rounded-full border border-cyan-300 bg-[#0566aa]/95 px-2.5 py-1 font-mono text-[10px] font-bold text-white shadow-lg"
                style={{ left: `${pipePreviewMidpoint.planX}%`, top: `${pipePreviewMidpoint.planY}%`, transform: `translate(-50%, calc(-50% + 16px)) scale(${textScale})`, transformOrigin: 'center' }}
              >
                ↔ {pipePreviewMeters.toFixed(2)} m
              </div>
            )}

            {calibrationPreviewDistance !== null && calibrationPreviewMidpoint && (
              <div
                className="pointer-events-none absolute z-20 rounded-full border border-[#f8d878] bg-[#0b2940]/95 px-2.5 py-1 font-mono text-[10px] font-bold text-white shadow-lg"
                style={{ left: `${calibrationPreviewMidpoint.planX}%`, top: `${calibrationPreviewMidpoint.planY}%`, transform: `translate(-50%, -50%) scale(${textScale})`, transformOrigin: 'center' }}
              >
                REF. {calibrationPreviewDistance.toFixed(1)}% del plano
              </div>
            )}

            {hoveredPlanPhoto && !placement && !creationMode && (() => {
              const isLongitudinal = getElementType(hoveredPlanPhoto) === 'tuberia' || isCable(hoveredPlanPhoto);
              const anchorX = isLongitudinal && hasCompletePipe(hoveredPlanPhoto)
                ? (hoveredPlanPhoto.planX! + hoveredPlanPhoto.planEndX!) / 2
                : hoveredPlanPhoto.planX!;
              const anchorY = isLongitudinal && hasCompletePipe(hoveredPlanPhoto)
                ? (hoveredPlanPhoto.planY! + hoveredPlanPhoto.planEndY!) / 2
                : hoveredPlanPhoto.planY!;
              const photoCount = hoveredPlanPhoto.imageUrls?.length || 1;
              return (
                <div
                  id={`element-preview-${hoveredPlanPhoto.id}`}
                  className="pointer-events-none absolute z-30 w-44 overflow-hidden rounded-lg border border-[#9fc2d2] bg-white shadow-[0_12px_28px_rgba(5,39,67,0.28)]"
                  style={{ left: `${anchorX}%`, top: `${anchorY}%`, transform: `translate(12px, calc(-100% - 10px)) scale(${Math.min(1, Math.max(0.72, iconScale))})`, transformOrigin: 'left bottom' }}
                  role="status"
                  aria-live="polite"
                >
                  <img src={hoveredPlanPhoto.imageUrl} alt={`Miniatura de ${elementLabel(hoveredPlanPhoto)}`} className="h-24 w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate font-mono text-[9px] font-bold text-[#073f74]">{elementLabel(hoveredPlanPhoto)}</span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-[#527284]">
                      <span className="material-symbols-outlined text-[12px]">photo_library</span>{photoCount}
                    </span>
                  </div>
                </div>
              );
            })()}

            {positionedPhotos.map((photo) => {
              const type = getElementType(photo);
              if (type === 'tuberia' || isCable(photo)) {
                if (!hasCompletePipe(photo)) return null;
                const midpointX = (photo.planX! + photo.planEndX!) / 2;
                const midpointY = (photo.planY! + photo.planEndY!) / 2;
                const actaName = photo.acta?.trim();
                const cable = isCable(photo);
                const longitudinalMarkerColor = isNotStarted(photo)
                  ? NO_STARTED_MARKER_COLOR
                  : cable ? getCableTypeOption(photo.cableType).color : '#073f74';
                return (
                  <React.Fragment key={photo.id}>
                    <button
                      type="button"
                      draggable={isAdmin && !placement && !isMultipleSelectionMode}
                      onDragStart={(event) => startDragging(event, photo, 'plan')}
                      onDragEnd={() => {
                        dragTargetRef.current = null;
                        setDragTarget(null);
                      }}
                      onMouseEnter={() => setHoveredPlanPhotoId(photo.id)}
                      onMouseLeave={() => setHoveredPlanPhotoId((current) => current === photo.id ? null : current)}
                      onFocus={() => setHoveredPlanPhotoId(photo.id)}
                      onBlur={() => setHoveredPlanPhotoId((current) => current === photo.id ? null : current)}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (placement || creationMode) return;
                        if (isMultipleSelectionMode) {
                          togglePlanPhotoSelection(photo.id);
                        } else {
                          setSelectedPlanPhotoId(photo.id);
                        }
                      }}
                      style={{ left: `${midpointX}%`, top: `${midpointY}%`, backgroundColor: longitudinalMarkerColor, transform: `translate(-50%, -50%) scale(${iconScale})` }}
                      id={`plan-marker-${photo.id}`}
                      className={`absolute z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition hover:scale-110 active:cursor-grabbing ${placement || creationMode ? 'pointer-events-none' : isMultipleSelectionMode ? 'cursor-pointer' : 'cursor-grab'} ${(isMultipleSelectionMode ? selectedPlanPhotoIds.includes(photo.id) : selectedPlanPhotoId === photo.id) ? 'ring-4 ring-cyan-300 ring-offset-2' : focusedPlanPhotoId === photo.id ? 'ring-4 ring-amber-300 ring-offset-2 animate-pulse' : ''}`}
                      title={isMultipleSelectionMode ? `Seleccionar ${elementLabel(photo)}` : `Abrir o mover ${elementLabel(photo)}`}
                      aria-label={isMultipleSelectionMode ? `Seleccionar ${elementLabel(photo)}` : `Abrir o mover ${elementLabel(photo)}`}
                      aria-describedby={hoveredPlanPhotoId === photo.id ? `element-preview-${photo.id}` : undefined}
                    >
                      <span className="material-symbols-outlined text-[18px]">{cable ? 'cable' : 'timeline'}</span>
                    </button>
                    {arePipeNamesVisible && (
                      <span
                        className="pointer-events-none absolute z-20 max-w-[160px] truncate rounded-md border border-indigo-500/35 bg-white/95 px-1.5 py-1 font-mono text-[9px] font-bold text-indigo-800 shadow-[0_3px_10px_rgba(55,48,163,0.22)]"
                        style={getCameraNameStyle(midpointX, midpointY, 5 + iconScale * 16, textScale)}
                        title={pipeNameLabel(photo)}
                      >
                        {pipeNameLabel(photo)}
                      </span>
                    )}
                    {actaName && areActaLabelsVisible && photo.showActaLabel !== false && (
                      <span
                        className="pointer-events-none absolute z-20 flex max-w-[150px] items-center gap-1 whitespace-nowrap rounded-md border border-[#0b5d8c]/35 bg-white/95 px-1.5 py-1 font-mono text-[9px] font-bold text-[#0b4770] shadow-[0_3px_10px_rgba(7,63,116,0.24)]"
                        style={getActaLabelStyle(midpointX, midpointY, photo.actaLabelPosition, 4 + iconScale * 16, textScale)}
                        title={actaName}
                      >
                        <span className="material-symbols-outlined text-[13px]">assignment</span>
                        <span className="truncate">{actaName}</span>
                      </span>
                    )}
                  </React.Fragment>
                );
              }

              const isCamera = type === 'camara';
              const electrical = isElectricalPhoto(photo);
              const electricalOption = getElectricalElementOption(photo.electricalType);
              const baseMarkerColor = electrical
                ? photo.electricalColor || electricalOption.color
                : !isCamera
                  ? '#b77812'
                : photo.cameraType === 'BT'
                  ? '#b94324'
                  : photo.cameraType === 'Datos'
                    ? '#f97316'
                    : '#0566aa';
              const markerColor = isNotStarted(photo) ? NO_STARTED_MARKER_COLOR : baseMarkerColor;
              const actaName = photo.acta?.trim();
              const cameraName = isCamera ? cameraNameLabel(photo) : null;
              return (
                <React.Fragment key={photo.id}>
                  <button
                    type="button"
                    draggable={isAdmin && !placement && !isMultipleSelectionMode}
                    onDragStart={(event) => startDragging(event, photo, 'plan')}
                    onDragEnd={() => {
                      dragTargetRef.current = null;
                      setDragTarget(null);
                    }}
                    onMouseEnter={() => setHoveredPlanPhotoId(photo.id)}
                    onMouseLeave={() => setHoveredPlanPhotoId((current) => current === photo.id ? null : current)}
                    onFocus={() => setHoveredPlanPhotoId(photo.id)}
                    onBlur={() => setHoveredPlanPhotoId((current) => current === photo.id ? null : current)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (placement || creationMode) return;
                      if (isMultipleSelectionMode) {
                        togglePlanPhotoSelection(photo.id);
                      } else {
                        setSelectedPlanPhotoId(photo.id);
                      }
                    }}
                    style={{ left: `${photo.planX}%`, top: `${photo.planY}%`, backgroundColor: markerColor, transform: `translate(-50%, -50%) scale(${iconScale})` }}
                    id={`plan-marker-${photo.id}`}
                    className={`absolute z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-white shadow-[0_3px_10px_rgba(6,36,58,0.35)] transition hover:scale-110 active:cursor-grabbing ${placement || creationMode ? 'pointer-events-none' : isMultipleSelectionMode ? 'cursor-pointer' : 'cursor-grab'} ${(isMultipleSelectionMode ? selectedPlanPhotoIds.includes(photo.id) : selectedPlanPhotoId === photo.id) ? 'ring-4 ring-cyan-300 ring-offset-2' : focusedPlanPhotoId === photo.id ? 'ring-4 ring-amber-300 ring-offset-2 animate-pulse' : ''}`}
                    title={isMultipleSelectionMode ? `Seleccionar ${elementLabel(photo)}` : `Abrir o mover ${elementLabel(photo)}`}
                    aria-label={isMultipleSelectionMode ? `Seleccionar ${elementLabel(photo)}` : `Abrir o mover ${elementLabel(photo)}`}
                    aria-describedby={hoveredPlanPhotoId === photo.id ? `element-preview-${photo.id}` : undefined}
                  >
                    <span className="material-symbols-outlined text-[18px]">{electrical ? electricalOption.icon : isCamera ? 'videocam' : 'inventory_2'}</span>
                  </button>
                  {cameraName && areCameraNamesVisible && (
                    <span
                      className="pointer-events-none absolute z-20 max-w-[160px] truncate rounded-md border border-[#0566aa]/35 bg-white/95 px-1.5 py-1 font-mono text-[9px] font-bold text-[#075a91] shadow-[0_3px_10px_rgba(6,36,58,0.24)]"
                      style={getCameraNameStyle(photo.planX!, photo.planY!, 5 + iconScale * 18, textScale)}
                      title={cameraName}
                    >
                      {cameraName}
                    </span>
                  )}
                  {actaName && areActaLabelsVisible && photo.showActaLabel !== false && (
                    <span
                      className="pointer-events-none absolute z-20 flex max-w-[150px] items-center gap-1 whitespace-nowrap rounded-md border border-[#0b5d8c]/35 bg-white/95 px-1.5 py-1 font-mono text-[9px] font-bold text-[#0b4770] shadow-[0_3px_10px_rgba(6,36,58,0.24)]"
                      style={getActaLabelStyle(photo.planX!, photo.planY!, photo.actaLabelPosition, 4 + iconScale * 18, textScale)}
                      title={actaName}
                    >
                      <span className="material-symbols-outlined text-[13px]">assignment</span>
                      <span className="truncate">{actaName}</span>
                    </span>
                  )}
                </React.Fragment>
              );
            })}
            </div>
          </div>
        ) : (
          <div className="max-w-lg rounded-2xl border border-dashed border-[#8bb5c9] bg-white p-8 text-center shadow-[0_14px_34px_rgba(7,63,116,0.12)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e4f4fb] text-[#0566aa]">
              <span className="material-symbols-outlined text-[30px]">upload_file</span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#0b2940]">Carga el plano JPG de la obra</h2>
            <p className="mt-2 text-sm leading-6 text-[#547181]">El plano se ajustará automáticamente a la pantalla. Después podrás seleccionar un elemento pendiente y hacer clic exactamente donde debe quedar ubicado.</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0566aa] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#004d84]">
              <span className="material-symbols-outlined text-[19px]">add_photo_alternate</span>
              Seleccionar JPG
            </button>
          </div>
        )}
      </main>

      {isMultipleSelectionMode && !placementInstruction && (
        <aside className="absolute right-4 top-[138px] z-30 w-[min(92vw,340px)] rounded-xl border border-[#729bad] bg-white/95 p-3.5 shadow-[0_14px_32px_rgba(7,63,116,0.2)] backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-[#d3e1e8] pb-2.5">
            <div>
              <p className="font-mono text-[9px] font-bold tracking-[0.14em] text-[#0b5d8c]">SELECCIÓN MÚLTIPLE</p>
              <p className="mt-0.5 text-sm font-bold text-[#0b2940]">
                {selectedMultiplePlanPhotos.length} de {positionedPhotos.length} seleccionados
              </p>
            </div>
            <button
              type="button"
              onClick={exitMultipleSelection}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#527284] transition hover:bg-[#eaf3f8] hover:text-[#0b2940]"
              aria-label="Salir de la selección múltiple"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Filtros rápidos de selección */}
          <div className="mt-2.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={selectAllPositioned}
              className="rounded-md border border-[#c2d7e3] bg-[#f0f6fa] px-2 py-0.5 text-[11px] font-semibold text-[#184860] hover:bg-[#e2edf4]"
              title="Seleccionar todos los elementos del plano actual"
            >
              Todos ({positionedPhotos.length})
            </button>
            <button
              type="button"
              onClick={selectCamerasOnly}
              className="rounded-md border border-[#c2d7e3] bg-[#f0f6fa] px-2 py-0.5 text-[11px] font-semibold text-[#184860] hover:bg-[#e2edf4]"
              title="Seleccionar solo cámaras"
            >
              Cámaras
            </button>
            <button
              type="button"
              onClick={selectPipesOnly}
              className="rounded-md border border-[#c2d7e3] bg-[#f0f6fa] px-2 py-0.5 text-[11px] font-semibold text-[#184860] hover:bg-[#e2edf4]"
              title="Seleccionar solo tuberías"
            >
              Tuberías
            </button>
            <button
              type="button"
              onClick={selectElectricalOnly}
              className="rounded-md border border-[#c2d7e3] bg-[#f0f6fa] px-2 py-0.5 text-[11px] font-semibold text-[#184860] hover:bg-[#e2edf4]"
              title="Seleccionar solo elementos eléctricos y cables"
            >
              Eléctricos
            </button>
            <button
              type="button"
              onClick={invertSelection}
              className="rounded-md border border-[#c2d7e3] bg-[#f0f6fa] px-2 py-0.5 text-[11px] font-semibold text-[#184860] hover:bg-[#e2edf4]"
              title="Invertir selección actual"
            >
              Invertir
            </button>
          </div>

          <p className="mt-2 text-xs leading-4.5 text-[#547181]">
            Toca los iconos o tramos en el plano para agregarlos/quitarlos.
          </p>

          {/* Botón principal: Ajuste Grupal */}
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setIsBulkEditModalOpen(true)}
              disabled={!selectedMultiplePlanPhotos.length}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#004d99] px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#003870] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              Ajustar en grupo ({selectedMultiplePlanPhotos.length})
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlanPhotoIds([])}
                disabled={!selectedMultiplePlanPhotos.length}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-[#b4cbd8] bg-white px-2 text-xs font-bold text-[#315c70] transition hover:bg-[#eaf6fb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Limpiar
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setPhotosPendingDeletion(selectedMultiplePlanPhotos)}
                  disabled={!selectedMultiplePlanPhotos.length}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-[#b42318] px-2 text-xs font-bold text-white transition hover:bg-[#8d1b13] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                  Eliminar ({selectedMultiplePlanPhotos.length})
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {selectedPlanPhoto && !placementInstruction && !isMultipleSelectionMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-slate-950/10 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:items-center sm:bg-transparent sm:p-4" role="presentation">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={() => setSelectedPlanPhotoId(null)}
            aria-label="Cerrar propiedades del elemento"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="selected-element-title"
            className="relative z-10 flex max-h-[calc(100dvh-1rem-env(safe-area-inset-bottom))] min-h-0 w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#8eb4c7] bg-white shadow-[0_24px_72px_rgba(7,63,116,0.34)] sm:max-h-[min(86vh,720px)] sm:rounded-xl"
          >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#d3e1e8] bg-[#f4fbfe] px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-bold tracking-[0.14em] text-[#527284]">ELEMENTO SELECCIONADO</p>
              <h2 id="selected-element-title" className="mt-0.5 truncate text-base font-bold text-[#0b2940] sm:text-lg">
                {getElementType(selectedPlanPhoto) === 'camara'
                  ? getCameraSelectionLabel(selectedPlanPhoto.cameraCode, selectedPlanPhoto.name)
                  : elementLabel(selectedPlanPhoto)}
              </h2>
            </div>
            <button type="button" onClick={() => setSelectedPlanPhotoId(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#b4cbd8] bg-white text-[#315c70] transition hover:bg-[#eaf6fb]" aria-label="Cerrar propiedades del elemento">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
            {/* Estado de ejecución y avance */}
            <div className="rounded-xl border border-[#b7d5e4] bg-[#f4fbfe] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] font-bold tracking-[0.12em] text-[#527284]">ESTADO & AVANCE</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  selectedPlanPhoto.executionStatus === 'Terminado' || getPhotoProgressPercentage(selectedPlanPhoto) === 100
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedPlanPhoto.executionStatus === 'En proceso' || getPhotoProgressPercentage(selectedPlanPhoto) > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    selectedPlanPhoto.executionStatus === 'Terminado' || getPhotoProgressPercentage(selectedPlanPhoto) === 100
                      ? 'bg-emerald-500'
                      : selectedPlanPhoto.executionStatus === 'En proceso' || getPhotoProgressPercentage(selectedPlanPhoto) > 0
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`} />
                  {selectedPlanPhoto.executionStatus === 'Terminado' || getPhotoProgressPercentage(selectedPlanPhoto) === 100
                    ? 'Terminada'
                    : selectedPlanPhoto.executionStatus === 'En proceso' || getPhotoProgressPercentage(selectedPlanPhoto) > 0
                    ? 'En proceso'
                    : 'No iniciada'}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#0b2940]">
                  <span>Progreso de obra</span>
                  <span className="font-mono text-sm text-[#0566aa]">{getPhotoProgressPercentage(selectedPlanPhoto)}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#dbe8ef]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      getPhotoProgressPercentage(selectedPlanPhoto) === 100
                        ? 'bg-emerald-500'
                        : getPhotoProgressPercentage(selectedPlanPhoto) > 0
                        ? 'bg-[#0566aa]'
                        : 'bg-slate-300'
                    }`}
                    style={{ width: `${getPhotoProgressPercentage(selectedPlanPhoto)}%` }}
                  />
                </div>
              </div>
            </div>

          {getElementType(selectedPlanPhoto) === 'tuberia' && (
            <>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[#b7d5e4] bg-[#eaf6fb] px-2.5 py-2">
                <span className="font-mono text-[9px] font-bold tracking-[0.12em] text-[#527284]">LONGITUD {blueprint.calibration ? 'CALIBRADA' : 'REGISTRADA'}</span>
                <span className="font-mono text-sm font-bold text-[#0b5d8c]">{Number.parseFloat(String(selectedPlanPhoto.metraje ?? 0)).toFixed(2)} m</span>
              </div>
              <div className="mt-3 border border-[#b7d5e4] bg-white p-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] font-bold tracking-[0.12em] text-[#0b5d8c]">CONDUCCIONES DEL TRAMO</p>
                    <p className="mt-0.5 text-[10px] text-[#547181]">Los colores corresponden a cada red. Configura o agrega conducciones desde Propiedades.</p>
                  </div>
                  <span className="material-symbols-outlined text-[17px] text-[#075a91]">account_tree</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {(selectedPlanPhoto.pipeConduits?.length ? selectedPlanPhoto.pipeConduits : [{
                    id: `legacy-${selectedPlanPhoto.id}`,
                    networkType: getPipeNetworkOption(selectedPlanPhoto.pipeNetworkType).value,
                    configuration: selectedPlanPhoto.tramo || 'sin medida',
                    meters: selectedPlanPhoto.metraje ?? 0,
                  }]).map((conduit) => {
                    const option = getPipeNetworkOption(conduit.networkType);
                    return (
                      <div key={conduit.id} className="flex items-center justify-between gap-2 border border-[#d7e6ee] bg-[#f8fcfe] px-2 py-1.5">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-[#173f58]">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                          {option.label} · {conduit.configuration || 'sin calibre'}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] font-bold text-[#0b5d8c]">{conduit.meters || '0'} m</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 border border-[#b7d5e4] bg-[#f7fcfe] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[9px] font-bold tracking-[0.12em] text-[#0b5d8c]">AJUSTE PRECISO · % DEL PLANO</p>
                  <span className="material-symbols-outlined text-[16px] text-[#075a91]">tune</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[#547181]">Edita los extremos con precisión de 0,01%. Los puntos blancos del tramo indican inicio y final.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([
                    ['Inicio X', 'planX'],
                    ['Inicio Y', 'planY'],
                    ['Final X', 'planEndX'],
                    ['Final Y', 'planEndY'],
                  ] as const).map(([label, key]) => (
                    <label key={key} className="block">
                      <span className="mb-1 block font-mono text-[8px] font-bold tracking-[0.08em] text-[#547181]">{label}</span>
                      <input
                        key={`${selectedPlanPhoto.id}-${key}-${selectedPlanPhoto[key]}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue={Number(selectedPlanPhoto[key] ?? 0).toFixed(2)}
                        onBlur={(event) => {
                          const value = Number.parseFloat(event.currentTarget.value);
                          if (Number.isFinite(value)) updatePipeGeometry(selectedPlanPhoto, { [key]: value });
                        }}
                        className="h-8 w-full border border-[#b4cbd8] bg-white px-2 font-mono text-[11px] font-bold text-[#173f58] outline-none transition focus:border-[#0566aa] focus:ring-2 focus:ring-[#0566aa]/15"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-2 border border-[#c7dce7] bg-white px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[8px] font-bold tracking-[0.1em] text-[#547181]">DIMENSIÓN DEL TRAMO</p>
                    <label className="flex items-center gap-1 text-[9px] font-semibold text-[#607d8b]">
                      Ajuste
                      <input
                        type="number"
                        min="1"
                        max="75"
                        step="1"
                        inputMode="decimal"
                        value={pipeDimensionPercent}
                        onChange={(event) => setPipeDimensionPercent(event.target.value)}
                        className="h-6 w-10 border border-[#b4cbd8] bg-white px-1 text-center font-mono text-[10px] font-bold text-[#173f58] outline-none focus:border-[#0566aa]"
                        aria-label="Porcentaje para aumentar o disminuir la longitud del tramo"
                      />
                      %
                    </label>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustPipeLength(selectedPlanPhoto, Math.max(0.01, 1 - getPipeDimensionAdjustment()))}
                      className="inline-flex h-8 items-center justify-center gap-1 border border-[#b4cbd8] bg-white px-2 text-[10px] font-bold text-[#315c70] transition hover:bg-[#eaf6fb]"
                      title="Disminuir la longitud visual del tramo usando el porcentaje indicado"
                    >
                      <span className="material-symbols-outlined text-[14px]">remove</span>
                      Disminuir
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustPipeLength(selectedPlanPhoto, 1 + getPipeDimensionAdjustment())}
                      className="inline-flex h-8 items-center justify-center gap-1 border border-[#0566aa] bg-[#f4fbfe] px-2 text-[10px] font-bold text-[#075a91] transition hover:bg-[#e6f6ff]"
                      title="Aumentar la longitud visual del tramo usando el porcentaje indicado"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      Aumentar
                    </button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 border-t border-[#e0ebf0] pt-1.5">
                    <button
                      type="button"
                      onClick={undoPipeDimension}
                      disabled={pipeDimensionUndoStack.at(-1)?.photoId !== selectedPlanPhoto.id}
                      className="inline-flex h-7 items-center justify-center gap-1 border border-[#b4cbd8] bg-white px-2 text-[10px] font-bold text-[#315c70] transition hover:bg-[#eaf6fb] disabled:cursor-not-allowed disabled:opacity-40"
                      title="Deshacer el último cambio de dimensión de este tramo"
                    >
                      <span className="material-symbols-outlined text-[14px]">undo</span>
                      Deshacer
                    </button>
                    <button
                      type="button"
                      onClick={redoPipeDimension}
                      disabled={pipeDimensionRedoStack.at(-1)?.photoId !== selectedPlanPhoto.id}
                      className="inline-flex h-7 items-center justify-center gap-1 border border-[#b4cbd8] bg-white px-2 text-[10px] font-bold text-[#315c70] transition hover:bg-[#eaf6fb] disabled:cursor-not-allowed disabled:opacity-40"
                      title="Rehacer el último cambio de dimensión de este tramo"
                    >
                      <span className="material-symbols-outlined text-[14px]">redo</span>
                      Rehacer
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={() => updatePipeGeometry(selectedPlanPhoto, { planEndY: selectedPlanPhoto.planY })} className="h-8 border border-[#9ec7d8] bg-white px-1 text-[10px] font-bold text-[#075a91] transition hover:bg-[#eaf6fb]">Horizontal</button>
                  <button type="button" onClick={() => updatePipeGeometry(selectedPlanPhoto, { planEndX: selectedPlanPhoto.planX })} className="h-8 border border-[#9ec7d8] bg-white px-1 text-[10px] font-bold text-[#075a91] transition hover:bg-[#eaf6fb]">Vertical</button>
                  <button type="button" onClick={() => {
                    const distance = Math.max(Math.abs(selectedPlanPhoto.planEndX! - selectedPlanPhoto.planX!), Math.abs(selectedPlanPhoto.planEndY! - selectedPlanPhoto.planY!));
                    updatePipeGeometry(selectedPlanPhoto, {
                      planEndX: selectedPlanPhoto.planX! + Math.sign(selectedPlanPhoto.planEndX! - selectedPlanPhoto.planX! || 1) * distance,
                      planEndY: selectedPlanPhoto.planY! + Math.sign(selectedPlanPhoto.planEndY! - selectedPlanPhoto.planY! || 1) * distance,
                    });
                  }} className="h-8 border border-[#9ec7d8] bg-white px-1 text-[10px] font-bold text-[#075a91] transition hover:bg-[#eaf6fb]">45°</button>
                </div>
              </div>
            </>
          )}
          {selectedPlanPhoto.acta?.trim() && (
            <div className="mt-3 flex items-center justify-between gap-3 border border-[#b7d5e4] bg-[#f4fbfe] px-2.5 py-2">
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-bold tracking-[0.12em] text-[#527284]">RÓTULO DE ACTA</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[#0b4770]">{selectedPlanPhoto.acta}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={selectedPlanPhoto.showActaLabel !== false}
                onClick={() => onUpdatePhoto({ ...selectedPlanPhoto, showActaLabel: selectedPlanPhoto.showActaLabel === false })}
                className={`inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-bold transition ${selectedPlanPhoto.showActaLabel !== false ? 'border-[#80c7de] bg-white text-[#075a91] hover:bg-[#e6f6ff]' : 'border-[#b9cbd3] bg-[#f2f6f8] text-[#5b6f7a] hover:bg-white'}`}
                title={selectedPlanPhoto.showActaLabel !== false ? 'Ocultar rótulo de acta en el plano' : 'Mostrar rótulo de acta en el plano'}
              >
                <span className="material-symbols-outlined text-[16px]">{selectedPlanPhoto.showActaLabel !== false ? 'visibility' : 'visibility_off'}</span>
                {selectedPlanPhoto.showActaLabel !== false ? 'Visible' : 'Oculto'}
              </button>
            </div>
          )}
          <div className="sticky bottom-0 -mx-4 mt-4 shrink-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 border-t border-[#d3e1e8] bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:-mx-5 sm:px-5">
            <button type="button" onClick={() => onEditPhoto(selectedPlanPhoto)} className="inline-flex h-10 items-center justify-center gap-1.5 bg-[#0566aa] px-2 text-xs font-bold text-white transition hover:bg-[#004d84] sm:h-9 sm:px-3">
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Propiedades
            </button>
            <button type="button" onClick={() => onSelectPhoto(selectedPlanPhoto)} className="inline-flex h-10 items-center justify-center gap-1.5 border border-[#b4cbd8] bg-white px-2 text-xs font-bold text-[#154860] transition hover:bg-[#eaf6fb] sm:h-9 sm:px-3">
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              Detalle
            </button>
            <button
              type="button"
              onClick={() => setPhotosPendingDeletion([selectedPlanPhoto])}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#f0b4b0] bg-[#fff7f6] text-[#b42318] transition hover:bg-[#ffdad6] sm:h-9 sm:w-9"
              title="Eliminar elemento"
              aria-label={`Eliminar ${elementLabel(selectedPlanPhoto)}`}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
          </div>
        </aside>
        </div>
      )}

      {photosPendingDeletion.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-element-title" className="w-full max-w-md border border-[#e4aaa5] bg-white shadow-[0_20px_60px_rgba(105,35,29,0.32)]">
            <div className="flex items-start gap-3 border-b border-[#f2d0cd] bg-[#fff5f4] px-5 py-4">
              <span className="material-symbols-outlined mt-0.5 text-[24px] text-[#b42318]">warning</span>
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[#8c2f27]">ELIMINAR DEL PLANO</p>
                <h2 id="delete-element-title" className="mt-1 text-lg font-bold text-[#4a1714]">¿Eliminar {photosPendingDeletion.length === 1 ? 'este elemento' : 'estos elementos'}?</h2>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-sm leading-6 text-[#5d3c39]">
                {photosPendingDeletion.length === 1 ? (
                  <>Se eliminará <strong>{elementLabel(photosPendingDeletion[0])}</strong> del plano y de su registro de inspección.</>
                ) : (
                  <>Se eliminarán <strong>{photosPendingDeletion.length} elementos</strong> del plano y de sus registros de inspección.</>
                )} Esta acción no se puede deshacer.
              </p>
              <div className="rounded-lg border border-[#f0d2cf] bg-[#fff9f8] px-3 py-2 font-mono text-[10px] font-bold tracking-[0.1em] text-[#8c2f27]">
                {photosPendingDeletion.length === 1
                  ? `${getElementType(photosPendingDeletion[0]).toUpperCase()} · REGISTRO ${photosPendingDeletion[0].displayId || photosPendingDeletion[0].id}`
                  : `${photosPendingDeletion.map((photo) => elementLabel(photo)).slice(0, 3).join(' · ')}${photosPendingDeletion.length > 3 ? ` · +${photosPendingDeletion.length - 3}` : ''}`}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#f2d0cd] px-5 py-4">
              <button type="button" onClick={() => setPhotosPendingDeletion([])} className="h-9 border border-[#b4cbd8] bg-white px-3 text-xs font-bold text-[#315c70] transition hover:bg-[#eaf6fb]">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  onDeletePhotos(photosPendingDeletion.map((photo) => photo.id));
                  setHasPendingPlanChanges(true);
                  setPhotosPendingDeletion([]);
                  setSelectedPlanPhotoId(null);
                  exitMultipleSelection();
                }}
                className="inline-flex h-9 items-center gap-1.5 bg-[#b42318] px-3 text-xs font-bold text-white transition hover:bg-[#8d1b13]"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Eliminar {photosPendingDeletion.length === 1 ? 'elemento' : `(${photosPendingDeletion.length})`}
              </button>
            </div>
          </section>
        </div>
      )}

      {isCalibrationDialogOpen && calibrationDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={saveCalibration} className="w-full max-w-md border border-[#9dbbc9] bg-white shadow-[0_20px_60px_rgba(7,63,116,0.32)]">
            <div className="flex items-start justify-between border-b border-[#d3e1e8] bg-[#eaf6fb] px-5 py-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[#527284]">ESCALA DEL PLANO</p>
                <h2 className="mt-1 text-lg font-bold text-[#0b2940]">Calibrar distancia real</h2>
              </div>
              <button type="button" onClick={cancelCalibration} aria-label="Cancelar calibración" className="text-[#527284] transition hover:text-[#0b2940]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="border-l-4 border-[#eab308] bg-[#fff9e8] px-3 py-2.5 text-xs leading-5 text-[#684e08]">
                Marcaste una referencia de <strong>{calibrationDraft.referenceDistancePercent.toFixed(1)}% del plano</strong>. Indica cuántos metros reales representa ese tramo.
              </div>
              <div>
                <label htmlFor="calibration-meters" className="mb-1.5 block text-xs font-bold text-[#0b2940]">Distancia real de referencia (metros)</label>
                <div className="flex overflow-hidden border border-[#8bb5c9] bg-white focus-within:border-[#0566aa] focus-within:ring-2 focus-within:ring-[#0566aa]/15">
                  <input
                    id="calibration-meters"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={calibrationMeters}
                    onChange={(event) => setCalibrationMeters(event.target.value)}
                    className="h-11 min-w-0 flex-1 px-3 text-sm font-semibold text-[#0b2940] outline-none"
                    required
                    autoFocus
                  />
                  <span className="flex items-center border-l border-[#c7d7df] bg-[#f4fafc] px-3 font-mono text-xs font-bold text-[#315c70]">m</span>
                </div>
              </div>
              <p className="text-[11px] leading-5 text-[#607d8b]">Al guardar, los tramos existentes y los nuevos se medirán en metros reales con esta escala. El zoom visual no altera las medidas.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#d3e1e8] px-5 py-4">
              <button type="button" onClick={cancelCalibration} className="h-9 border border-[#b4cbd8] bg-white px-3 text-xs font-bold text-[#315c70] transition hover:bg-[#eaf6fb]">Cancelar</button>
              <button type="submit" className="inline-flex h-9 items-center gap-1.5 bg-[#0566aa] px-3 text-xs font-bold text-white transition hover:bg-[#004d84]">
                <span className="material-symbols-outlined text-[16px]">straighten</span>
                Guardar escala
              </button>
            </div>
          </form>
        </div>
      )}

      {blueprint.imageUrl && pendingPhotos.length > 0 && (
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-xl border border-[#b6d0dd] bg-white/95 p-2 shadow-sm backdrop-blur">
          <span className="hidden font-mono text-[9px] font-bold tracking-[0.12em] text-[#527284] sm:inline">ARRASTRA</span>
          {pendingPhotos.map((photo) => {
            const type = getElementType(photo);
            const icon = type === 'camara' ? 'videocam' : type === 'tuberia' ? 'timeline' : 'inventory_2';
            const color = type === 'camara' ? 'bg-[#0566aa]' : type === 'tuberia' ? 'bg-[#073f74]' : 'bg-[#b77812]';
            return (
              <button
                key={`palette-${photo.id}`}
                type="button"
                draggable
                onDragStart={(event) => startDragging(event, photo, 'palette')}
                onDragEnd={() => {
                  dragTargetRef.current = null;
                  setDragTarget(null);
                }}
                onClick={() => selectForPlacement(photo)}
                className={`flex h-9 w-9 cursor-grab items-center justify-center rounded-full border-2 border-white ${color} text-white shadow-sm transition hover:scale-110 active:cursor-grabbing`}
                title={`Arrastra o selecciona ${elementLabel(photo)} para ubicarlo`}
                aria-label={`Arrastra o selecciona ${elementLabel(photo)} para ubicarlo`}
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
              </button>
            );
          })}
        </div>
      )}

      {placementInstruction && (
        <div className="absolute bottom-5 left-1/2 z-30 flex w-[min(92vw,560px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-[#73b7d4] bg-[#073f74] px-4 py-3 text-sm text-white shadow-xl">
          <span className="material-symbols-outlined text-[21px] text-cyan-200">ads_click</span>
          <p className="flex-1 font-medium">{placementInstruction}</p>
          {(creationMode === 'tuberia' || creationMode === 'cableado') && pipeStart && (
            <div className="flex shrink-0 overflow-hidden rounded-md border border-cyan-100/35 bg-white/10 text-[10px] font-bold">
              {([
                ['libre', 'Libre'],
                ['horizontal', 'H'],
                ['vertical', 'V'],
                ['diagonal', '45°'],
              ] as const).map(([alignment, label]) => (
                <button
                  key={alignment}
                  type="button"
                  onClick={() => setPipeAlignment(alignment)}
                  className={`h-7 min-w-7 border-l border-cyan-100/20 px-1.5 transition first:border-l-0 ${pipeAlignment === alignment ? 'bg-cyan-200 text-[#073f74]' : 'text-cyan-50 hover:bg-white/10'}`}
                  title={`Alinear nuevo tramo: ${label}`}
                  aria-pressed={pipeAlignment === alignment}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { setPlacement(null); setCreationMode(null); setPipeStart(null); setPipePreview(null); if (calibrationMode) cancelCalibration(); }} className="rounded-md px-2 py-1 text-xs font-bold text-cyan-100 hover:bg-white/10">Cancelar</button>
        </div>
      )}

      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2 z-20 flex items-center gap-1.5 sm:bottom-4 sm:right-4 sm:gap-2">
        {blueprint.imageUrl && <button
          type="button"
          onClick={() => {
            setAreSecondaryAccessesCollapsed((collapsed) => {
              if (!collapsed) setActiveMapPopover(null);
              return !collapsed;
            });
          }}
          aria-label={areSecondaryAccessesCollapsed ? 'Mostrar accesos secundarios' : 'Ocultar accesos secundarios'}
          aria-expanded={!areSecondaryAccessesCollapsed}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#9fc4d4] bg-[#eaf6fb] text-[#075a91] shadow-sm transition hover:bg-[#dff2fa] sm:hidden"
          title={areSecondaryAccessesCollapsed ? 'Mostrar accesos' : 'Ocultar accesos'}
        >
          <span className="material-symbols-outlined text-[21px]">{areSecondaryAccessesCollapsed ? 'unfold_more' : 'unfold_less'}</span>
        </button>}
        <div data-testid="secondary-map-accesses" className={areSecondaryAccessesCollapsed ? 'hidden sm:contents' : 'contents'}>
        {blueprint.imageUrl && (
          <div className="static sm:relative">
            {activeMapPopover === 'view' && (
              <div role="dialog" aria-label="Ajustes de vista del plano" className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] left-2 right-2 max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-xl border border-[#b7d4e1] bg-white shadow-[0_14px_30px_rgba(10,54,83,0.22)] sm:absolute sm:bottom-12 sm:left-auto sm:right-0 sm:max-h-[min(75vh,32rem)] sm:w-[min(20rem,calc(100vw-2rem))]">
                <div className="flex items-center justify-between border-b border-[#d7e5eb] bg-[#f3faff] px-3 py-2.5">
                  <div><p className="font-mono text-[10px] font-bold tracking-[0.12em] text-[#0566aa]">VISTA DEL PLANO</p><p className="mt-0.5 text-xs font-semibold text-[#24485b]">Escala y legibilidad</p></div>
                  <button type="button" onClick={() => setActiveMapPopover(null)} className="grid h-7 w-7 place-items-center rounded-md text-[#486a7c] hover:bg-white" aria-label="Cerrar ajustes de vista"><span className="material-symbols-outlined text-[18px]">close</span></button>
                </div>
                <div className="divide-y divide-[#e1ebef] px-3">
                  {[
                    { label: 'Plano', value: Math.round(planScale * 100), icon: 'zoom_in', iconClass: 'text-[#0566aa]', decrease: () => adjustPlanScale(-0.25), increase: () => adjustPlanScale(0.25), decreaseDisabled: planScale <= 0.45, increaseDisabled: planScale >= 8, decreaseLabel: 'Reducir tamaño del plano', increaseLabel: 'Aumentar tamaño del plano' },
                    { label: 'Iconos', value: Math.round(iconScale * 100), icon: 'ads_click', iconClass: 'text-[#b77812]', decrease: () => adjustIconScale(-0.1), increase: () => adjustIconScale(0.1), decreaseDisabled: iconScale <= 0.2, increaseDisabled: iconScale >= 1.8, decreaseLabel: 'Reducir tamaño de los iconos', increaseLabel: 'Aumentar tamaño de los iconos' },
                    { label: 'Textos', value: Math.round(textScale * 100), icon: 'text_fields', iconClass: 'text-[#0b5d8c]', decrease: () => adjustTextScale(-0.1), increase: () => adjustTextScale(0.1), decreaseDisabled: textScale <= 0.25, increaseDisabled: textScale >= 1.8, decreaseLabel: 'Reducir tamaño de los textos del plano', increaseLabel: 'Aumentar tamaño de los textos del plano' },
                  ].map((control) => (
                    <div key={control.label} className="flex items-center gap-2 py-2.5">
                      <span className={`material-symbols-outlined text-[18px] ${control.iconClass}`}>{control.icon}</span>
                      <span className="flex-1 text-xs font-bold text-[#355c70]">{control.label} <span className="font-mono text-[#0b2940]">{control.value}%</span></span>
                      <button type="button" onClick={control.decrease} disabled={control.decreaseDisabled} className="grid h-7 w-7 place-items-center rounded-md text-[#285b72] hover:bg-[#eaf6fb] disabled:cursor-not-allowed disabled:opacity-35" aria-label={control.decreaseLabel}><span className="material-symbols-outlined text-[17px]">remove</span></button>
                      <button type="button" onClick={control.increase} disabled={control.increaseDisabled} className="grid h-7 w-7 place-items-center rounded-md text-[#285b72] hover:bg-[#eaf6fb] disabled:cursor-not-allowed disabled:opacity-35" aria-label={control.increaseLabel}><span className="material-symbols-outlined text-[17px]">add</span></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={() => setActiveMapPopover((current) => current === 'view' ? null : 'view')} aria-label="Abrir ajustes de vista" aria-expanded={activeMapPopover === 'view'} aria-haspopup="dialog" className={`flex h-11 w-11 items-center justify-center rounded-xl border p-0 text-xs font-bold shadow-sm transition sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3 ${activeMapPopover === 'view' ? 'border-[#073f74] bg-[#073f74] text-white' : 'border-[#c7d7df] bg-white text-[#285b72] hover:bg-[#eaf6fb]'}`} title="Abrir ajustes de vista">
              <span className="material-symbols-outlined text-[20px] sm:text-[19px]">tune</span><span className="hidden md:inline">Vista</span>
            </button>
          </div>
        )}
        {blueprint.imageUrl && (
          <div className="static sm:relative">
            {activeMapPopover === 'tools' && (
              <div role="dialog" aria-label="Herramientas del plano" className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] left-2 right-2 max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-xl border border-[#b7d4e1] bg-white shadow-[0_14px_30px_rgba(10,54,83,0.22)] sm:absolute sm:bottom-12 sm:left-auto sm:right-0 sm:max-h-[min(75vh,32rem)] sm:w-[min(20rem,calc(100vw-2rem))]">
                <div className="flex items-center justify-between border-b border-[#d7e5eb] bg-[#f3faff] px-3 py-2.5">
                  <div><p className="font-mono text-[10px] font-bold tracking-[0.12em] text-[#0566aa]">OPERACIÓN</p><p className="mt-0.5 text-xs font-semibold text-[#24485b]">Herramientas del plano</p></div>
                  <button type="button" onClick={() => setActiveMapPopover(null)} className="grid h-7 w-7 place-items-center rounded-md text-[#486a7c] hover:bg-white" aria-label="Cerrar herramientas del plano"><span className="material-symbols-outlined text-[18px]">close</span></button>
                </div>
                <div className="space-y-2.5 p-3">
                  {isAdmin ? (
                    <button type="button" onClick={() => { setActiveMapPopover(null); startCalibration(); }} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-bold transition ${blueprint.calibration ? 'border-[#6ca9c5] bg-[#eaf6fb] text-[#075a91] hover:bg-[#dff2fa]' : 'border-[#e0bf78] bg-[#fffaf0] text-[#8b5d05] hover:bg-[#fff2d6]'}`}>
                      <span className="material-symbols-outlined text-[19px]">straighten</span><span className="flex-1">{blueprint.calibration ? 'Escala activa' : 'Calibrar plano'}</span><span className="material-symbols-outlined text-[17px]">chevron_right</span>
                    </button>
                  ) : (
                    <button type="button" disabled aria-label="Calibración disponible solo para administradores" className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg border border-[#d7e2e7] bg-[#f5f8fa] px-3 py-2.5 text-left text-xs font-bold text-[#718692] opacity-85">
                      <span className="material-symbols-outlined text-[19px]">lock</span><span className="flex-1">Calibración del administrador</span><span className="text-[10px] font-medium">Solo lectura</span>
                    </button>
                  )}
                  <div className="rounded-lg border border-[#d7e5eb] bg-[#fbfdfe] px-3 py-2 text-xs text-[#426373]"><strong className="text-[#0b2940]">{photos.filter((photo) => isPlaced(photo)).length}</strong> ubicados · <strong className="text-[#0b2940]">{totalPipelineMeters.toFixed(1)} m</strong> de tubería</div>
                  <button type="button" onClick={() => { const nextHandMode = !isHandToolActive; setIsHandToolActive(nextHandMode); setActiveMapPopover(null); if (nextHandMode) { exitMultipleSelection(); setPlacement(null); setCreationMode(null); setPipeStart(null); setPipePreview(null); if (calibrationMode) cancelCalibration(); } }} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-bold transition ${isHandToolActive ? 'border-[#073f74] bg-[#073f74] text-white' : 'border-[#c7d7df] bg-white text-[#285b72] hover:bg-[#eaf6fb]'}`} aria-pressed={isHandToolActive}>
                    <span className="material-symbols-outlined text-[19px]">pan_tool_alt</span><span className="flex-1">{isHandToolActive ? 'Mano activa' : 'Activar mano'}</span><span className="text-[10px] font-medium">Mover plano</span>
                  </button>
                </div>
              </div>
            )}
            <button type="button" onClick={() => setActiveMapPopover((current) => current === 'tools' ? null : 'tools')} aria-label="Abrir herramientas del plano" aria-expanded={activeMapPopover === 'tools'} aria-haspopup="dialog" className={`flex h-11 w-11 items-center justify-center rounded-xl border p-0 text-xs font-bold shadow-sm transition sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3 ${activeMapPopover === 'tools' ? 'border-[#073f74] bg-[#073f74] text-white' : 'border-[#c7d7df] bg-white text-[#285b72] hover:bg-[#eaf6fb]'}`} title="Abrir herramientas del plano">
              <span className="material-symbols-outlined text-[20px] sm:text-[19px]">construction</span><span className="hidden md:inline">Herramientas</span>
            </button>
          </div>
        )}
        <button type="button" onClick={() => { setActiveMapPopover(null); setIsFullscreen((value) => !value); }} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#c7d7df] bg-white text-[#285b72] shadow-sm transition hover:bg-[#eaf6fb] sm:h-10 sm:w-10" title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
          <span className="material-symbols-outlined text-[21px] sm:text-[20px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
        </div>
      </div>

      {isPanelOpen && (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" onClick={() => setIsPanelOpen(false)} aria-label="Cerrar panel de elementos" />
          <aside className="absolute inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#b8cfda] bg-white shadow-[-16px_0_42px_rgba(12,57,86,0.22)]">
            <div className="flex items-center justify-between border-b border-[#d6e2e8] px-5 py-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-[#507184]">UBICACIÓN MANUAL</p>
                <h2 className="mt-0.5 text-lg font-bold text-[#0b2940]">Elementos del plano</h2>
              </div>
              <button type="button" onClick={() => setIsPanelOpen(false)} aria-label="Cerrar panel" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c7d7df] text-[#315c70] transition hover:bg-[#eaf6fb]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded-xl border border-[#b7d5e4] bg-[#eaf6fb] p-3 text-xs leading-5 text-[#154860]">
                Selecciona un elemento y luego haz clic sobre el JPG. Las tuberías se dibujan con dos clics: inicio y final.
              </div>
              <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#527284]">Pendientes de ubicación ({pendingPhotos.length})</h3>
              <div className="mt-3 space-y-2">
                {pendingPhotos.length ? pendingPhotos.map((photo) => {
                  const type = getElementType(photo);
                  const isPipe = type === 'tuberia';
                  const description = isPipe && isPlaced(photo) ? 'Falta marcar el punto final' : isPipe ? 'Requiere inicio y final' : 'Requiere un punto';
                  return (
                    <button key={photo.id} type="button" onClick={() => selectForPlacement(photo)} className="flex w-full items-center gap-3 rounded-xl border border-[#d5e1e7] bg-white p-3 text-left transition hover:border-[#63a7c5] hover:bg-[#f5fbfd]">
                      <span className={`material-symbols-outlined rounded-lg p-2 text-white ${type === 'camara' ? 'bg-[#0566aa]' : type === 'tuberia' ? 'bg-[#007f98]' : 'bg-[#b77812]'}`}>
                        {type === 'camara' ? 'videocam' : type === 'tuberia' ? 'timeline' : 'inventory_2'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-[#143b4d]">{elementLabel(photo)}</span>
                        <span className="block truncate text-xs text-[#607d8b]">{description}</span>
                      </span>
                      <span className="material-symbols-outlined text-[#0566aa]">add_location_alt</span>
                    </button>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-[#c7d7df] p-5 text-center text-sm text-[#607d8b]">Todos los elementos están ubicados en el plano.</div>
                )}
              </div>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-[#527284]">Ya ubicados ({photos.length - pendingPhotos.length})</h3>
              <div className="mt-3 space-y-1.5">
                {photos.filter((photo) => isPlaced(photo)).map((photo) => (
                  <button key={photo.id} type="button" onClick={() => onSelectPhoto(photo)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#395f70] transition hover:bg-[#f0f8fb]">
                    <span className="material-symbols-outlined text-[17px] text-[#0566aa]">location_on</span>
                    <span className="min-w-0 flex-1 truncate">{elementLabel(photo)}</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-[#d6e2e8] p-4">
              <button type="button" onClick={onNavigateToUpload} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0566aa] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#004d84]">
                <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                Registrar elemento nuevo
              </button>
            </div>
          </aside>
        </div>
      )}

      <AlertDialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
        <AlertDialogContent className="border-[#c7d7df] bg-white font-['Roboto',sans-serif]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[#0b2940]">
              <span className="material-symbols-outlined text-[#b77812]">warning</span>
              ¿Volver al menú de áreas?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-[#547181]">
              Hay cambios recientes o una acción en curso en este plano. Los registros ya creados se conservan, pero se cancelará cualquier ubicación, trazado o calibración que aún esté en proceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#b4cbd8] text-[#154860]">Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReturnToAreas} className="bg-[#0566aa] text-white hover:bg-[#004d84]">Volver al menú</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkEditModal
        photos={selectedMultiplePlanPhotos}
        isOpen={isBulkEditModalOpen}
        isAdmin={isAdmin}
        canAssignActa={canAssignActa}
        onClose={() => setIsBulkEditModalOpen(false)}
        onSave={(updatedPhotos, summary) => {
          if (onBulkUpdatePhotos) {
            onBulkUpdatePhotos(updatedPhotos, summary);
          } else {
            updatedPhotos.forEach((photo) => onUpdatePhoto(photo));
          }
          setIsBulkEditModalOpen(false);
          exitMultipleSelection();
        }}
      />
    </section>
  );
};
