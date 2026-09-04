/**
 * Diseño: cartografía técnica sobria. El detalle de cualquier elemento mantiene
 * una salida directa hacia el plano para conservar el flujo espacial de trabajo.
 */
import React, { useState, useEffect } from 'react';
import {
  InspectionPhoto,
  InspectorProfile,
  AppSettings,
  ActivityItem,
  InspectionCollection,
  AppModule,
  ElementType,
  UserAccess,
  getElementType,
  getPipeNetworkOption,
  normalizePipeConduits,
  ElectricalElementType,
  getElectricalElementOption,
  getElectricalPlanArea,
  PlanArea,
  getPhotoProgressPercentage,
  ActivityActionCategory,
  getElementSector,
} from './types';
import {
  INITIAL_PHOTOS,
  DEFAULT_INSPECTOR,
  INITIAL_SETTINGS,
  INITIAL_COLLECTIONS,
  INITIAL_ACTIVITIES,
} from './data/mockData';
import { TopNavBar } from './components/TopNavBar';
import { SideNavBar } from './components/SideNavBar';
import { DashboardView } from './components/DashboardView';
import { PhotoDetailView } from './components/PhotoDetailView';
import { UploadPhotoView } from './components/UploadPhotoView';
import { SettingsView } from './components/SettingsView';
import { HistoryView } from './components/HistoryView';
import { ActivityView } from './components/ActivityView';
import { MapView } from './components/MapView';
import { DatabaseTableView } from './components/DatabaseTableView';
import { EditPhotoModal } from './components/EditPhotoModal';
import { ProfileModal } from './components/ProfileModal';
import { SignOutModal } from './components/SignOutModal';
import { AuthModal } from './components/AuthModal';
import { AuthScreen } from './components/AuthScreen';
import { SupabaseTablesModal } from './components/SupabaseTablesModal';
import { UserManagementView } from './components/UserManagementView';
import { supabaseService } from './services/supabaseService';
import { clearBlueprintImage, clearEvidenceImages, loadEvidenceImages, saveEvidenceImages } from './services/blueprintStorageService';
import { canAccessModule, createFallbackAccess, MODULE_DEFINITIONS } from './lib/accessControl';
import { applyPhotoUpdatePermissions } from './lib/photoPermissions';
import { useSupabaseConnection } from './hooks/useSupabaseConnection';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';

const normalizeSettings = (candidate?: Partial<AppSettings> | null): AppSettings => ({
  emailNotifications: candidate?.emailNotifications ?? INITIAL_SETTINGS.emailNotifications,
  pushNotifications: candidate?.pushNotifications ?? INITIAL_SETTINGS.pushNotifications,
  syncWifiOnly: candidate?.syncWifiOnly ?? INITIAL_SETTINGS.syncWifiOnly,
  highQualityUploads: candidate?.highQualityUploads ?? INITIAL_SETTINGS.highQualityUploads,
  allowInspectorActaAssignment: candidate?.allowInspectorActaAssignment ?? INITIAL_SETTINGS.allowInspectorActaAssignment,
  autoVerifyPassed: candidate?.autoVerifyPassed ?? INITIAL_SETTINGS.autoVerifyPassed,
  offlineStorageLimitMb: typeof candidate?.offlineStorageLimitMb === 'number'
    ? candidate.offlineStorageLimitMb
    : INITIAL_SETTINGS.offlineStorageLimitMb,
});
const normalizePlanCoordinate = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value >= 0 && value <= 100 ? value : undefined;
};

function isTechnicalPreview(imageUrl: string): boolean {
  return imageUrl.startsWith('data:image/svg+xml');
}

const normalizeInspectionPhoto = (photo: InspectionPhoto): InspectionPhoto => {
  const elementType = getElementType(photo);
  const candidateEvidenceUrls = Array.isArray(photo.imageUrls)
    ? photo.imageUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : photo.imageUrl ? [photo.imageUrl] : [];
  const evidenceUrls = candidateEvidenceUrls.filter((url) => !isTechnicalPreview(url));
  const imageUrl = evidenceUrls[0] || photo.imageUrl?.trim() || createMapElementPreview(elementType);
  const isPipeline = elementType === 'tuberia';
  const pipeConduits = isPipeline
    ? normalizePipeConduits(photo.pipeConduits, {
      networkType: getPipeNetworkOption(photo.pipeNetworkType).value,
      configuration: photo.tramo,
      meters: photo.metraje,
    })
    : [];
  const primaryConduit = pipeConduits[0];
  const sectorInfo = getElementSector(photo.name);

  return {
    ...photo,
    sector: sectorInfo.label,
    sectorCode: sectorInfo.code,
    elementType,
    imageUrl,
    imageUrls: evidenceUrls,
    name: photo.name ?? 'Inspección sin nombre',
    type: photo.type ?? '',
    location: photo.location ?? '',
    fieldNotes: photo.fieldNotes ?? '',
    executionStatus: photo.executionStatus ?? 'En proceso',
    status: photo.status ?? 'Synced',
    requiresImmediateAction: Boolean(photo.requiresImmediateAction),
    verified: Boolean(photo.verified),
    planArea: photo.electricalType || photo.planArea === 'electrical'
      ? getElectricalPlanArea(photo.electricalType)
      : photo.planArea || 'civil',
    electricalType: photo.electricalType,
    electricalColor: photo.electricalType ? getElectricalElementOption(photo.electricalType).color : undefined,
    tramo: isPipeline ? primaryConduit?.configuration : photo.tramo,
    metraje: isPipeline ? primaryConduit?.meters : photo.metraje,
    pipeNetworkType: isPipeline ? primaryConduit?.networkType : undefined,
    pipeColor: isPipeline && primaryConduit
      ? getPipeNetworkOption(primaryConduit.networkType).color
      : undefined,
    pipeConduits: isPipeline ? pipeConduits : undefined,
    planX: normalizePlanCoordinate(photo.planX),
    planY: normalizePlanCoordinate(photo.planY),
    planEndX: normalizePlanCoordinate(photo.planEndX),
    planEndY: normalizePlanCoordinate(photo.planEndY),
  };
};

const getEvidenceUrls = (photo: InspectionPhoto): string[] => {
  const imageUrls = Array.isArray(photo.imageUrls)
    ? photo.imageUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0 && !isTechnicalPreview(url))
    : [];
  return imageUrls.length > 0 ? imageUrls : photo.imageUrl && !isTechnicalPreview(photo.imageUrl) ? [photo.imageUrl] : [];
};

const isLargeEmbeddedEvidence = (imageUrl: string) => (
  imageUrl.startsWith('data:image/') && !imageUrl.startsWith('data:image/svg+xml')
);

const createLightweightPhotoCache = (photo: InspectionPhoto): InspectionPhoto => {
  const remoteEvidence = getEvidenceUrls(photo).filter((imageUrl) => !isLargeEmbeddedEvidence(imageUrl));
  const fallbackImageUrl = isLargeEmbeddedEvidence(photo.imageUrl)
    ? createMapElementPreview(getElementType(photo))
    : photo.imageUrl;
  return {
    ...photo,
    imageUrl: remoteEvidence[0] || fallbackImageUrl || createMapElementPreview(getElementType(photo)),
    imageUrls: remoteEvidence,
  };
};

const createMapElementPreview = (elementType: ElementType) => {
  const visual = elementType === 'camara'
    ? { accent: '#0566aa', symbol: 'C' }
    : elementType === 'caja'
      ? { accent: '#b77812', symbol: 'B' }
      : elementType === 'electrico'
        ? { accent: '#7c3aed', symbol: 'E' }
        : { accent: '#073f74', symbol: 'T' };
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#edf6fa"/><path d="M0 70H640M0 140H640M0 210H640M0 280H640M0 350H640M106 0V420M213 0V420M320 0V420M427 0V420M534 0V420" stroke="#c9dee8" stroke-width="2"/><circle cx="320" cy="210" r="86" fill="${visual.accent}"/><text x="320" y="237" text-anchor="middle" font-family="Arial, sans-serif" font-size="106" font-weight="700" fill="white">${visual.symbol}</text></svg>`,
  )}`;
};

export default function App() {
  const { connectionState, refreshConnection } = useSupabaseConnection();
  // Session Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('photovault_authenticated') === 'true';
  });

  // Local storage persisted state
  const [photos, setPhotos] = useState<InspectionPhoto[]>(() => {
    const saved = localStorage.getItem('photovault_photos');
    if (!saved) return INITIAL_PHOTOS;
    try {
      const parsed: InspectionPhoto[] = JSON.parse(saved);
      return parsed
        .filter((p) => !['photo-1', 'photo-2', 'photo-3', 'photo-4', 'photo-5'].includes(p.id))
        .map(normalizeInspectionPhoto);
    } catch {
      return INITIAL_PHOTOS;
    }
  });
  const [isEvidenceStorageReady, setIsEvidenceStorageReady] = useState(false);

  const [inspector, setInspector] = useState<InspectorProfile>(() => {
    const saved = localStorage.getItem('photovault_inspector');
    return saved ? JSON.parse(saved) : DEFAULT_INSPECTOR;
  });

  const [userAccess, setUserAccess] = useState<UserAccess>(() =>
    createFallbackAccess({ id: inspector.id, email: inspector.email, name: inspector.name }),
  );

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('photovault_settings');
    try {
      return normalizeSettings(saved ? JSON.parse(saved) : INITIAL_SETTINGS);
    } catch {
      return normalizeSettings(INITIAL_SETTINGS);
    }
  });

  const [collections, setCollections] = useState<InspectionCollection[]>(INITIAL_COLLECTIONS);

  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    const saved = localStorage.getItem('photovault_activities');
    if (!saved) return INITIAL_ACTIVITIES;
    try {
      const parsed: ActivityItem[] = JSON.parse(saved);
      return parsed.filter(
        (a) => !['act-1', 'act-2', 'act-3', 'act-4'].includes(a.id)
      );
    } catch {
      return INITIAL_ACTIVITIES;
    }
  });

  // Navigation & UI State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [editingPhoto, setEditingPhoto] = useState<InspectionPhoto | null>(null);
  const [mapFocusElementId, setMapFocusElementId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);

  // Las evidencias se hidratan desde IndexedDB para que localStorage contenga solo datos ligeros.
  useEffect(() => {
    let active = true;
    const hydrateEvidence = async () => {
      try {
        const hydratedPhotos = await Promise.all(photos.map(async (photo) => {
          const cachedEvidence = await loadEvidenceImages(photo.id);
          if (!cachedEvidence || cachedEvidence.length === 0) return photo;
          return normalizeInspectionPhoto({ ...photo, imageUrl: cachedEvidence[0], imageUrls: cachedEvidence });
        }));
        if (active) setPhotos(hydratedPhotos);
      } catch (error) {
        console.warn('No se pudieron recuperar todas las evidencias locales:', error);
      } finally {
        if (active) setIsEvidenceStorageReady(true);
      }
    };

    void hydrateEvidence();
    return () => {
      active = false;
    };
    // La hidratación se realiza una sola vez para no reemplazar cambios del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el registro ligero con localStorage y las evidencias completas con IndexedDB.
  useEffect(() => {
    try {
      localStorage.setItem('photovault_photos', JSON.stringify(photos.map(createLightweightPhotoCache)));
    } catch (error) {
      console.warn('No se pudo actualizar el caché ligero de inspecciones:', error);
    }

    if (!isEvidenceStorageReady) return;
    const persistEvidence = async () => {
      try {
        await Promise.all(photos.map((photo) => saveEvidenceImages(photo.id, getEvidenceUrls(photo))));
      } catch (error) {
        console.warn('No se pudieron actualizar algunas evidencias locales:', error);
      }
    };
    void persistEvidence();
  }, [isEvidenceStorageReady, photos]);

  useEffect(() => {
    localStorage.setItem('photovault_inspector', JSON.stringify(inspector));
  }, [inspector]);

  useEffect(() => {
    localStorage.setItem('photovault_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('photovault_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;

    const resolveUserAccess = async () => {
      await supabaseService.syncProfile(inspector, inspector.id);
      const access = await supabaseService.getUserAccess(inspector);
      if (active) setUserAccess(access);
    };

    resolveUserAccess();
    return () => {
      active = false;
    };
  }, [isAuthenticated, inspector.id, inspector.email, inspector.name]);

  // Recupera los registros remotos, incluidos los enlaces públicos de Supabase Storage.
  useEffect(() => {
    const checkAndLoadSupabase = async () => {
      if (supabaseService.isConfigured()) {
        try {
          const remotePhotos = await supabaseService.fetchPhotos();
          if (remotePhotos && remotePhotos.length > 0) {
            setPhotos((currentPhotos) => {
              const remoteIds = new Set(remotePhotos.map((photo) => photo.id));
              const localOnlyPhotos = currentPhotos.filter((photo) => !remoteIds.has(photo.id));
              return [...remotePhotos, ...localOnlyPhotos].map(normalizeInspectionPhoto);
            });
            showToast(`Se cargaron ${remotePhotos.length} inspecciones desde Supabase`, 'info');
          }
        } catch (err) {
          console.warn('Initial Supabase fetch skipped:', err);
        }
      }
    };
    checkAndLoadSupabase();
  }, []);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const syncPhotoToSupabase = (photo: InspectionPhoto, actionLabel: string) => {
    void supabaseService.savePhoto(photo, inspector.id).then((result) => {
      if (!result.success) {
        const stage = 'stage' in result ? result.stage : 'configuration';
        const message = 'message' in result ? result.message : '';
        const destination = stage === 'storage'
          ? 'Supabase Storage'
          : stage === 'database'
            ? 'la base de datos de Supabase'
            : 'la conexión de Supabase';
        showToast(
          `${actionLabel} quedó guardado en este dispositivo, pero ${destination} rechazó la sincronización. ${message}`,
          'error',
        );
      }
    });
  };

  const deletePhotoFromSupabase = (photo: InspectionPhoto) => {
    void supabaseService.deletePhoto(photo.id).then((deleted) => {
      if (!deleted) {
        showToast(`"${photo.name}" se eliminó localmente, pero no se pudo eliminar su registro o evidencias en Supabase Storage.`, 'error');
      }
    });
  };

  const addActivity = (
    action: string,
    photoName: string,
    photoId: string,
    type: ActivityItem['type'],
    extra?: Partial<ActivityItem>,
  ) => {
    const now = new Date();
    const newAct: ActivityItem = {
      id: `act-${Date.now()}`,
      timestamp: 'Justo ahora',
      dateRaw: now.toISOString(),
      action,
      photoName,
      photoId,
      user: inspector.name,
      userEmail: inspector.email,
      userRole: userAccess.role,
      type,
      ...extra,
    };
    setActivities((prev) => [newAct, ...prev]);

    // Sync activity to Supabase in background
    supabaseService.logActivity(newAct, inspector.id);
  };

  // Photo handlers
  const handleSelectPhoto = (photo: InspectionPhoto) => {
    setSelectedPhotoId(photo.id);
    setCurrentTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToGallery = () => {
    setSelectedPhotoId(null);
    setCurrentTab('dashboard');
  };

  const handleUpdatePhotoTitle = (id: string, newTitle: string) => {
    if (userAccess.role !== 'admin') {
      showToast('Solo el administrador puede cambiar el nombre de un elemento.', 'error');
      return;
    }
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, name: newTitle };
          syncPhotoToSupabase(updated, `El nombre de "${updated.name}"`);
          return updated;
        }
        return p;
      })
    );
  };

  const handleUpdatePhoto = (updated: InspectionPhoto) => {
    const current = photos.find((photo) => photo.id === updated.id);
    if (!current) return;
    const canAssignActa = userAccess.role === 'admin' || settings.allowInspectorActaAssignment;
    const protectedUpdate = applyPhotoUpdatePermissions({
      current,
      updated,
      isAdmin: userAccess.role === 'admin',
      canAssignActa,
    });
    setPhotos((prev) =>
      prev.map((p) => (p.id === protectedUpdate.id ? protectedUpdate : p))
    );

    // Auditoría detallada de cambios
    const currentProgress = getPhotoProgressPercentage(current);
    const updatedProgress = getPhotoProgressPercentage(protectedUpdate);
    let actionDescription = 'Detalles actualizados';
    let actionCategory: ActivityActionCategory = 'edit';
    let details: string | undefined;

    if (current.executionStatus !== protectedUpdate.executionStatus || current.status !== protectedUpdate.status) {
      if (currentProgress !== updatedProgress) {
        actionDescription = `Estado a "${protectedUpdate.executionStatus || protectedUpdate.status}" y avance al ${updatedProgress}%`;
        actionCategory = 'progress';
        details = `Estado (${current.executionStatus || current.status} → ${protectedUpdate.executionStatus || protectedUpdate.status}) y avance (${currentProgress}% → ${updatedProgress}%)`;
      } else {
        actionDescription = `Estado cambiado a ${protectedUpdate.executionStatus || protectedUpdate.status}`;
        actionCategory = 'status';
        details = `Estado modificado de "${current.executionStatus || current.status}" a "${protectedUpdate.executionStatus || protectedUpdate.status}"`;
      }
    } else if (currentProgress !== updatedProgress) {
      actionDescription = `Avance actualizado a ${updatedProgress}%`;
      actionCategory = 'progress';
      details = `Porcentaje de progreso de obra: ${currentProgress}% → ${updatedProgress}%`;
    } else if (current.verified !== protectedUpdate.verified) {
      actionDescription = protectedUpdate.verified ? 'Inspección certificada y aprobada' : 'Certificación de inspección removida';
      actionCategory = 'status';
      details = protectedUpdate.verified ? 'Elemento marcado como verificado' : 'Verificación desmarcada';
    } else if (current.metraje !== protectedUpdate.metraje) {
      actionDescription = `Metraje actualizado a ${protectedUpdate.metraje} m`;
      actionCategory = 'measurement';
      details = `Longitud: ${current.metraje ?? 0} m → ${protectedUpdate.metraje ?? 0} m`;
    } else if (current.acta !== protectedUpdate.acta) {
      actionDescription = `Acta asignada: ${protectedUpdate.acta || 'Sin acta'}`;
      actionCategory = 'acta';
      details = `Asignación de acta de obra modificada`;
    }

    addActivity(actionDescription, protectedUpdate.name, protectedUpdate.id, 'edit', {
      actionCategory,
      elementType: getElementType(protectedUpdate),
      details,
    });
    showToast(`Actualizado "${protectedUpdate.name}"`);

    syncPhotoToSupabase(protectedUpdate, `Los cambios de "${protectedUpdate.name}"`);
  };

  const handleBulkUpdatePhotos = (updatedList: InspectionPhoto[], summaryMessage?: string) => {
    if (!updatedList.length) return;
    const canAssignActa = userAccess.role === 'admin' || settings.allowInspectorActaAssignment;
    const protectedList = updatedList.map((updated) => {
      const current = photos.find((photo) => photo.id === updated.id);
      if (!current) return updated;
      return applyPhotoUpdatePermissions({
        current,
        updated,
        isAdmin: userAccess.role === 'admin',
        canAssignActa,
      });
    });

    const idMap = new Map(protectedList.map((p) => [p.id, p]));
    setPhotos((prev) => prev.map((p) => idMap.get(p.id) || p));

    protectedList.forEach((photo) => {
      syncPhotoToSupabase(photo, `El elemento "${photo.name}"`);
    });

    const msg = summaryMessage || `Ajuste grupal aplicado a ${protectedList.length} elementos`;
    addActivity(msg, `${protectedList.length} elementos`, protectedList[0]?.id || '', 'edit', {
      actionCategory: 'progress',
      details: `Ajuste grupal de propiedades en ${protectedList.length} elementos en el plano.`,
    });
    showToast(msg);
  };

  const handleUpdatePhotoPosition = (
    photoId: string,
    position: Pick<InspectionPhoto, 'planX' | 'planY' | 'planEndX' | 'planEndY'> & Partial<Pick<InspectionPhoto, 'metraje' | 'cableMeters'>>,
  ) => {
    if (userAccess.role !== 'admin') {
      showToast('Solo el administrador puede mover o fijar elementos en el plano.', 'error');
      return;
    }
    const currentPhoto = photos.find((photo) => photo.id === photoId);
    if (!currentPhoto) return;

    const updated = normalizeInspectionPhoto({
      ...currentPhoto,
      ...position,
      pipeConduits: position.metraje !== undefined && getElementType(currentPhoto) === 'tuberia'
        ? currentPhoto.pipeConduits?.map((conduit) => ({ ...conduit, meters: position.metraje! }))
        : currentPhoto.pipeConduits,
    });
    setPhotos((previous) => previous.map((photo) => (photo.id === photoId ? updated : photo)));
    syncPhotoToSupabase(updated, `La ubicación de "${updated.name}"`);
    addActivity('Ubicación actualizada en el plano', updated.name, updated.id, 'edit');
    showToast(`Ubicación guardada para "${updated.name}"`);
  };

  const handleUpdatePipelineMeasurements = (
    measurements: Array<Pick<InspectionPhoto, 'id' | 'metraje'>>,
  ) => {
    if (userAccess.role !== 'admin') return;
    const valuesById = new Map(measurements.map((measurement) => [measurement.id, measurement.metraje]));
    const recordsToSync: InspectionPhoto[] = [];
    const updatedPhotos = photos.map((photo) => {
      const metraje = valuesById.get(photo.id);
      if (metraje === undefined) return photo;
      const updated = normalizeInspectionPhoto({
        ...photo,
        metraje,
        pipeConduits: photo.pipeConduits?.map((conduit) => ({ ...conduit, meters: metraje })),
        ...(photo.electricalType === 'cableado' ? { cableMeters: metraje } : {}),
      });
      recordsToSync.push(updated);
      return updated;
    });

    setPhotos(updatedPhotos);
    recordsToSync.forEach((photo) => {
      syncPhotoToSupabase(photo, `La medición de "${photo.name}"`);
    });
  };

  const handleCreatePhotoFromPlan = (
    elementType: ElementType,
    position: Pick<InspectionPhoto, 'planX' | 'planY' | 'planEndX' | 'planEndY'>,
    initialMetraje?: number,
    electricalType?: ElectricalElementType,
    electricalArea?: PlanArea,
  ): InspectionPhoto => {
    if (userAccess.role !== 'admin') {
      throw new Error('Solo el administrador puede crear elementos en el plano.');
    }
    const createdAt = new Date();
    const suffix = Math.floor(100 + Math.random() * 900);
    const isCamera = elementType === 'camara';
    const isPipeline = elementType === 'tuberia';
    const isElectrical = elementType === 'electrico' && Boolean(electricalType);
    const isCable = electricalType === 'cableado';
    const electricalOption = getElectricalElementOption(electricalType);
    const cableType = electricalArea === 'electrical_lighting'
      ? 'alumbrado'
      : electricalArea === 'electrical_bt' ? 'baja_tension' : 'media_tension';
    const elementName = isCable ? 'Cableado' : isCamera ? 'Cámara' : isPipeline ? 'Tramo de tubería' : 'Caja';
    const newPhoto = normalizeInspectionPhoto({
      id: `plan-${Date.now()}`,
      displayId: `INSP-${createdAt.getFullYear()}-${suffix}`,
      name: isElectrical ? `Nuevo ${electricalOption.label.toLowerCase()}` : isCamera ? 'Nueva cámara' : isPipeline ? 'Nuevo tramo de tubería' : 'Nueva caja',
      imageUrl: createMapElementPreview(elementType),
      date: createdAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
        + `, ${createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dateRaw: createdAt.toISOString().slice(0, 10),
      status: 'Synced',
      executionStatus: 'En proceso',
      category: isElectrical ? 'electrical' : 'inspection',
      categoryLabel: isElectrical ? 'Obras Eléctricas' : 'Inspección General',
      location: 'Plano de obra',
      elementType,
      planArea: isElectrical ? electricalArea || getElectricalPlanArea(electricalType) : 'civil',
      electricalType: isElectrical ? electricalType : undefined,
      electricalColor: isElectrical ? electricalOption.color : undefined,
      cableType: isCable ? cableType : undefined,
      cableGauge: isCable ? (electricalArea === 'electrical_lighting' ? '12' : '350') : undefined,
      cableMeters: isCable ? initialMetraje ?? 0 : undefined,
      cameraCode: isCamera ? 'SB850' : undefined,
      cameraType: isCamera ? 'MT' : undefined,
      tramo: isPipeline ? '2x6"' : undefined,
      metraje: isPipeline ? initialMetraje ?? 0 : undefined,
      pipeNetworkType: isPipeline ? 'baja_tension' : undefined,
      pipeColor: isPipeline ? getPipeNetworkOption('baja_tension').color : undefined,
      pipeConduits: isPipeline ? [{
        id: 'baja_tension-1',
        networkType: 'baja_tension',
        configuration: '2x6"',
        meters: initialMetraje ?? 0,
      }] : undefined,
      ...position,
      inspectorName: inspector.name,
      inspectorId: inspector.id,
      inspectorAvatar: inspector.avatarUrl,
      type: isElectrical ? electricalOption.label : isCamera ? 'Cámara de inspección' : isPipeline ? 'Canalización de obra' : 'Caja de inspección',
      verified: false,
      fieldNotes: 'Creado directamente en el plano de obra.',
      requiresImmediateAction: false,
      fileSize: 'Plano JPG',
      resolution: 'Ubicación relativa',
    });

    setPhotos((previous) => [newPhoto, ...previous]);
    syncPhotoToSupabase(newPhoto, `El elemento "${newPhoto.name}"`);
    addActivity('Elemento creado directamente en el plano', newPhoto.name, newPhoto.id, 'upload');
    showToast(`${elementName} agregada al plano`);
    return newPhoto;
  };

  const handleDeletePhotos = (ids: string[]) => {
    if (userAccess.role !== 'admin') {
      showToast('Solo el administrador puede eliminar elementos del plano.', 'error');
      return;
    }
    const idsToDelete = new Set(ids);
    const recordsToDelete = photos.filter((photo) => idsToDelete.has(photo.id));
    if (!recordsToDelete.length) return;

    setPhotos((prev) => prev.filter((photo) => !idsToDelete.has(photo.id)));
    if (selectedPhotoId && idsToDelete.has(selectedPhotoId)) {
      setSelectedPhotoId(null);
      setCurrentTab('dashboard');
    }
    recordsToDelete.forEach((photo) => {
      addActivity('Inspección eliminada', photo.name, photo.id, 'flag');
      deletePhotoFromSupabase(photo);
    });
    showToast(
      recordsToDelete.length === 1
        ? `"${recordsToDelete[0].name}" ha sido eliminada`
        : `${recordsToDelete.length} elementos han sido eliminados`,
      'info',
    );
  };

  const handleDeletePhoto = (id: string) => handleDeletePhotos([id]);

  const handleUploadSuccess = (newPhoto: InspectionPhoto) => {
    setPhotos((prev) => [newPhoto, ...prev]);
    addActivity('Foto de inspección subida', newPhoto.name, newPhoto.id, 'upload');
    showToast(`"${newPhoto.name}" subida exitosamente`);
    
    syncPhotoToSupabase(newPhoto, `La foto de "${newPhoto.name}"`);

    setSelectedPhotoId(newPhoto.id);
    setCurrentTab('detail');
  };

  const handleOpenPhotoFromActivity = (photoId: string) => {
    const found = photos.find((p) => p.id === photoId);
    if (found) {
      setSelectedPhotoId(photoId);
      setCurrentTab('detail');
    } else {
      showToast('La foto de inspección ya no está disponible en la caché.', 'error');
    }
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    const normalizedSettings = normalizeSettings(newSettings);
    setSettings(
      userAccess.role === 'admin'
        ? normalizedSettings
        : {
          ...normalizedSettings,
          allowInspectorActaAssignment: settings.allowInspectorActaAssignment,
        },
    );
    showToast('Preferencias actualizadas');
  };

  const handleResetOperationalData = async () => {
    if (userAccess.role !== 'admin') {
      throw new Error('Solo el administrador puede restablecer los datos de inspección.');
    }

    const result = await supabaseService.resetOperationalData();
    if (!result.success) {
      throw new Error(result.error || 'No se pudo restablecer la base de datos de inspección.');
    }

    setPhotos([]);
    setActivities([]);
    setCollections([]);
    setSettings(normalizeSettings(INITIAL_SETTINGS));
    setSelectedPhotoId(null);
    setEditingPhoto(null);

    [
      'photovault_photos',
      'photovault_activities',
      'photovault_blueprint',
      'photovault_plan_icon_scale',
      'photovault_plan_text_scale',
      'photovault_plan_acta_labels_visible',
    ].forEach((key) => localStorage.removeItem(key));

    try {
      await Promise.all([clearBlueprintImage(), clearEvidenceImages()]);
    } catch {
      // El estado de la aplicación ya se limpió; la próxima carga no conservará los medios locales previos.
    }

  };

  const handleSaveProfile = (updatedProfile: InspectorProfile) => {
    const oldInspector = inspector;
    setInspector(updatedProfile);
    // Also propagate new avatar and name to photos belonging to this inspector
    setPhotos((prev) =>
      prev.map((p) =>
        p.inspectorId === updatedProfile.id || p.inspectorName === oldInspector.name || p.inspectorId === oldInspector.id
          ? {
              ...p,
              inspectorName: updatedProfile.name,
              inspectorAvatar: updatedProfile.avatarUrl,
              inspectorId: updatedProfile.id,
            }
          : p
      )
    );
    supabaseService.syncProfile(updatedProfile, updatedProfile.id);
    showToast('Credenciales y foto del inspector actualizadas');
  };

  const handleAuthSuccess = (newProfile: InspectorProfile, userEmail: string) => {
    setInspector(newProfile);
    setUserAccess(createFallbackAccess({ id: newProfile.id, email: newProfile.email, name: newProfile.name }));
    setIsAuthenticated(true);
    sessionStorage.setItem('photovault_authenticated', 'true');
    showToast(`Sesión iniciada como ${newProfile.name} (${userEmail})`, 'success');
  };

  const handleRestoreBackup = (backupData: {
    photos?: InspectionPhoto[];
    inspector?: InspectorProfile;
    settings?: AppSettings;
    activities?: ActivityItem[];
  }) => {
    if (backupData.photos && Array.isArray(backupData.photos)) {
      setPhotos(backupData.photos.map(normalizeInspectionPhoto));
    }
    if (backupData.inspector) {
      setInspector(backupData.inspector);
    }
    if (backupData.settings) {
      setSettings(normalizeSettings(backupData.settings));
    }
    if (backupData.activities && Array.isArray(backupData.activities)) {
      setActivities(backupData.activities);
    }
    showToast('Respaldo cargado exitosamente en la memoria del dispositivo.', 'success');
  };

  const handlePhotosImported = (importedPhotos: InspectionPhoto[]) => {
    setPhotos(importedPhotos);
    showToast(`Se cargaron ${importedPhotos.length} fotos desde Supabase`, 'success');
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'admin' && userAccess.role !== 'admin') {
      showToast('Solo los administradores pueden gestionar usuarios y permisos.', 'error');
      return;
    }

    const isOperationalModule = MODULE_DEFINITIONS.some((module) => module.id === tab);
    if (isOperationalModule && !canAccessModule(userAccess, tab as AppModule)) {
      showToast('Tu usuario no tiene permiso para acceder a este módulo.', 'error');
      return;
    }

    if (tab !== 'detail') {
      setSelectedPhotoId(null);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const activeModule = MODULE_DEFINITIONS.find((module) => module.id === currentTab);
    if (currentTab === 'admin' && userAccess.role !== 'admin') {
      setCurrentTab('dashboard');
    } else if (activeModule && !canAccessModule(userAccess, activeModule.id)) {
      const fallbackModule = MODULE_DEFINITIONS.find((module) => canAccessModule(userAccess, module.id));
      setCurrentTab(fallbackModule?.id || 'dashboard');
    }
  }, [currentTab, userAccess]);

  // If not authenticated, display full Authentication Gate directly
  if (!isAuthenticated) {
    return (
      <AuthScreen
        onAuthSuccess={handleAuthSuccess}
        defaultInspector={inspector}
      />
    );
  }

  const selectedPhoto = photos.find((p) => p.id === selectedPhotoId);

  // make sure to consider if you need authentication for certain routes
  return (
    <div className="min-h-screen flex flex-col bg-[#f3faff] text-[#071e27] font-['Inter']">
      {/* Fixed Top Nav Bar */}
      <TopNavBar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        inspector={inspector}
        allowedModules={userAccess.allowedModules}
        isAdmin={userAccess.role === 'admin'}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        activities={activities}
        onOpenPhoto={handleOpenPhotoFromActivity}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        connectionState={connectionState}
        onRefreshConnection={refreshConnection}
      />

      <div className="flex flex-1 pt-16">
        {/* Fixed Side Nav Bar (Desktop & Mobile Drawer) */}
        <SideNavBar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          inspector={inspector}
          allowedModules={userAccess.allowedModules}
          isAdmin={userAccess.role === 'admin'}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onSignOut={() => setIsSignOutModalOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        />

        {/* Main Content Area */}
        <div className={`flex-1 md:ml-64 flex flex-col ${currentTab === 'map' ? 'h-[calc(100vh-64px)] overflow-hidden' : 'min-h-[calc(100vh-64px)] justify-between'}`}>
          <main className={`${currentTab === 'map' ? 'p-0 h-full w-full relative overflow-hidden' : 'p-4 sm:p-6 lg:p-8 flex-1'}`}>
            {currentTab === 'admin' && userAccess.role === 'admin' ? (
              <UserManagementView currentUser={userAccess} onShowToast={showToast} />
            ) : currentTab === 'detail' && selectedPhoto ? (
              <PhotoDetailView
                photo={selectedPhoto}
                onBack={handleBackToGallery}
                onBackToMap={() => {
                  handleTabChange('map');
                  if (canAccessModule(userAccess, 'map')) {
                    showToast('Regresaste al mapa del elemento seleccionado', 'info');
                  }
                }}
                onEdit={(photo) => setEditingPhoto(photo)}
                onDelete={handleDeletePhoto}
                onUpdatePhoto={handleUpdatePhoto}
              />
            ) : currentTab === 'map' ? (
              <MapView
                photos={photos}
                inspector={inspector}
                isAdmin={userAccess.role === 'admin'}
                canAssignActa={userAccess.role === 'admin' || settings.allowInspectorActaAssignment}
                onSelectPhoto={handleSelectPhoto}
                onNavigateToUpload={() => handleTabChange('upload')}
                onUpdatePhoto={handleUpdatePhoto}
                onBulkUpdatePhotos={handleBulkUpdatePhotos}
                onUpdatePhotoPosition={handleUpdatePhotoPosition}
                onUpdatePipelineMeasurements={handleUpdatePipelineMeasurements}
                onCreatePhoto={handleCreatePhotoFromPlan}
                onEditPhoto={(photo) => setEditingPhoto(photo)}
                onDeletePhotos={handleDeletePhotos}
                focusElementId={mapFocusElementId}
                onFocusElementHandled={() => setMapFocusElementId(null)}
              />
            ) : currentTab === 'database' ? (
              <DatabaseTableView
                photos={photos}
                inspector={inspector}
                onSelectPhoto={handleSelectPhoto}
                onNavigateToMap={(targetPhoto) => {
                  if (targetPhoto) {
                    setSelectedPhotoId(targetPhoto.id);
                  }
                  handleTabChange('map');
                }}
                onNavigateToUpload={() => handleTabChange('upload')}
                onEditPhoto={(photo) => setEditingPhoto(photo)}
                onDeletePhoto={handleDeletePhoto}
                onUpdatePhoto={handleUpdatePhoto}
              />
            ) : currentTab === 'upload' ? (
              <UploadPhotoView
                onUploadSuccess={handleUploadSuccess}
                onCancel={handleBackToGallery}
                inspector={inspector}
                onOpenAuth={() => setIsAuthModalOpen(true)}
              />
            ) : currentTab === 'settings' ? (
              <SettingsView
                settings={settings}
                onSaveSettings={handleSaveSettings}
                inspector={inspector}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onShowToast={showToast}
                onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
                photos={photos}
                activities={activities}
                onRestoreBackup={handleRestoreBackup}
                canResetOperationalData={userAccess.role === 'admin'}
                onResetOperationalData={handleResetOperationalData}
                canManageActaAssignment={userAccess.role === 'admin'}
              />
            ) : currentTab === 'history' || currentTab === 'collections' ? (
              <HistoryView
                photos={photos}
                onSelectPhoto={handleSelectPhoto}
                onUpdatePhoto={handleUpdatePhoto}
                onDeletePhoto={handleDeletePhoto}
                onNavigateToUpload={() => handleTabChange('upload')}
              />
            ) : currentTab === 'activity' ? (
              <ActivityView
                activities={activities}
                photos={photos}
                onOpenPhoto={handleOpenPhotoFromActivity}
                isAdmin={userAccess.role === 'admin'}
                onClearLogs={() => setActivities([])}
              />
            ) : (
              <DashboardView
                photos={photos}
                inspector={inspector}
                onSelectPhoto={handleSelectPhoto}
                onUpdatePhotoTitle={handleUpdatePhotoTitle}
                onDeletePhoto={handleDeletePhoto}
                onNavigateToUpload={() => handleTabChange('upload')}
                onNavigateToMap={(targetPhoto) => {
                  if (targetPhoto) {
                    setSelectedPhotoId(targetPhoto.id);
                  }
                  handleTabChange('map');
                }}
                onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
              />
            )}
          </main>

          {/* Footer - only for non-map views */}
          {currentTab !== 'map' && <Footer />}
        </div>
      </div>

      {/* Supabase Tables & Schema Modal */}
      <SupabaseTablesModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        photos={photos}
        inspector={inspector}
        onPhotosImported={handlePhotosImported}
        onShowToast={showToast}
      />

      {/* Supabase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        currentInspector={inspector}
      />

      {/* Edit Photo Details Modal */}
      {editingPhoto && (
        <EditPhotoModal
          photo={editingPhoto}
          isOpen={!!editingPhoto}
          isAdmin={userAccess.role === 'admin'}
          canAssignActa={userAccess.role === 'admin' || settings.allowInspectorActaAssignment}
          onClose={() => setEditingPhoto(null)}
          onSave={(updatedPhoto) => {
            handleUpdatePhoto(updatedPhoto);
            setEditingPhoto(null);
            setSelectedPhotoId(updatedPhoto.id);
            setCurrentTab('map');
            setMapFocusElementId(updatedPhoto.id);
          }}
        />
      )}

      {/* Inspector Profile Modal */}
      <ProfileModal
        inspector={inspector}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfile}
      />

      {/* Sign Out Confirmation Modal */}
      <SignOutModal
        isOpen={isSignOutModalOpen}
        onClose={() => setIsSignOutModalOpen(false)}
        onConfirm={() => {
          setIsSignOutModalOpen(false);
          setIsAuthenticated(false);
          sessionStorage.removeItem('photovault_authenticated');
          showToast('Has cerrado sesión correctamente', 'info');
        }}
        inspector={inspector}
      />

      {/* Floating Action Toast Notification */}
      <Toast
        message={toast?.message || null}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
