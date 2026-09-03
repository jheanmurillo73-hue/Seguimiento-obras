/**
 * Diseño: cartografía técnica sobria. La ficha evita mezclar propiedades de
 * categorías distintas y comunica el alcance real del elemento seleccionado.
 */
import React, { useEffect, useState } from 'react';
import { groupEvidenceTimelineByDate, InspectionPhoto, normalizeEvidenceTimeline, getElementType, getElementSector } from '../types';

const formatTimelineDay = (day: string) => {
  if (day === 'Sin fecha') return day;
  return new Date(`${day}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatTimelineTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Hora no disponible' : date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const formatGraphicTimelineDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface PhotoDetailViewProps {
  photo: InspectionPhoto;
  onBack: () => void;
  onBackToMap?: () => void;
  originTab?: string;
  onEdit: (photo: InspectionPhoto) => void;
  onDelete: (id: string) => void;
  onUpdatePhoto: (updated: InspectionPhoto) => void;
}

export const PhotoDetailView: React.FC<PhotoDetailViewProps> = ({
  photo,
  onBack,
  onBackToMap,
  originTab = 'dashboard',
  onEdit,
  onDelete,
  onUpdatePhoto,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const handleToggleActionRequired = (value: boolean) => {
    onUpdatePhoto({
      ...photo,
      requiresImmediateAction: value,
      status: value ? 'Flagged' : 'Synced',
    });
  };

  const handleToggleVerified = () => {
    onUpdatePhoto({
      ...photo,
      verified: !photo.verified,
    });
  };

  const handleToggleExecutionStatus = (status: 'En proceso' | 'Terminado') => {
    onUpdatePhoto({
      ...photo,
      executionStatus: status,
    });
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(photo.displayId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const currentExecutionStatus = photo.executionStatus || 'En proceso';
  const elementType = getElementType(photo);
  const evidenceTimeline = normalizeEvidenceTimeline(photo);
  const galleryImages = evidenceTimeline.map((entry) => entry.url);
  const timelineGroups = groupEvidenceTimelineByDate(evidenceTimeline);
  const graphicalTimelineEntries = evidenceTimeline
    .map((entry, originalIndex) => ({ ...entry, originalIndex }))
    .sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt));
  const graphicalTimelineWidth = Math.max(360, graphicalTimelineEntries.length * 118);
  const graphicalTimelinePoints = graphicalTimelineEntries.map((entry, index) => {
    const x = graphicalTimelineEntries.length === 1
      ? graphicalTimelineWidth / 2
      : 58 + index * ((graphicalTimelineWidth - 116) / (graphicalTimelineEntries.length - 1));
    const y = [132, 88, 148, 106, 138, 94][index % 6];
    return { ...entry, x, y };
  });
  const hasEvidence = galleryImages.length > 0;
  const activeImageUrl = galleryImages[activeImageIndex] || galleryImages[0];
  const hasMultipleImages = galleryImages.length > 1;

  useEffect(() => {
    if (!hasEvidence) setIsFullscreen(false);
  }, [hasEvidence]);

  useEffect(() => {
    setActiveImageIndex((current) => Math.min(current, Math.max(0, galleryImages.length - 1)));
    setZoomLevel(1);
  }, [photo.id, galleryImages.length]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
      if (event.key === 'ArrowLeft' && hasMultipleImages) setActiveImageIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
      if (event.key === 'ArrowRight' && hasMultipleImages) setActiveImageIndex((current) => (current + 1) % galleryImages.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryImages.length, hasMultipleImages, isFullscreen]);

  const showPreviousImage = () => {
    setActiveImageIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
    setZoomLevel(1);
  };

  const showNextImage = () => {
    setActiveImageIndex((current) => (current + 1) % galleryImages.length);
    setZoomLevel(1);
  };

  const openImageFullscreen = (index: number) => {
    if (!hasEvidence) return;
    setActiveImageIndex(index);
    setZoomLevel(1);
    setIsFullscreen(true);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#c2c6d4] shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Back to Map Button - Highlighted if coming from Map */}
          {onBackToMap && (
            <button
              type="button"
              onClick={onBackToMap}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-['Inter'] font-bold text-[13px] transition-all shadow-2xs ${
                originTab === 'map'
                  ? 'bg-[#004d99] hover:bg-[#003d7a] text-white ring-2 ring-[#004d99]/30'
                  : 'bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1a73e8] border border-[#1a73e8]/30'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">map</span>
              <span>Regresar al Plano</span>
              {originTab === 'map' && (
                <span className="px-1.5 py-0.2 bg-white/20 text-white text-[10px] rounded-full uppercase tracking-wider font-mono">
                  Origen
                </span>
              )}
            </button>
          )}

          {/* Back to Dashboard / Gallery Button */}
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-['Inter'] font-semibold text-[13px] transition-colors ${
              originTab !== 'map'
                ? 'bg-[#004d99] hover:bg-[#003d7a] text-white'
                : 'bg-[#f3faff] hover:bg-[#cfe6f2] text-[#424752] border border-[#c2c6d4]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
            <span>Panel Principal / Galería</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#727783]">
          <span className="inline-flex items-center gap-1 bg-[#f3faff] px-2.5 py-1 rounded-md border border-[#c2c6d4]">
            <span className="material-symbols-outlined text-[15px] text-[#004d99]">location_city</span>
            Terminal A-12 / Registro de Inspecciones
          </span>
        </div>
      </div>

      {/* Main Content Layout: Large Photo Left + Properties Right */}
      <div className="flex flex-col lg:flex-row gap-4 w-full">
        {/* Left: Large Photo View */}
        <div className="flex-1 bg-[#f3faff] border border-[#c2c6d4] rounded-xl overflow-hidden flex flex-col shadow-xs relative group min-h-[480px] lg:min-h-[640px]">
          {/* Image Area */}
          <div className="flex-1 relative bg-[#e6f6ff] flex items-center justify-center p-4 overflow-hidden select-none">
            {hasEvidence ? (
              <button
                type="button"
                onClick={() => openImageFullscreen(activeImageIndex)}
                aria-label={`Abrir foto ${activeImageIndex + 1} de ${galleryImages.length} a pantalla completa`}
                className="w-full h-full flex items-center justify-center transition-transform duration-200"
                style={{
                  transform: `scale(${zoomLevel})`,
                  cursor: zoomLevel > 1 ? 'grab' : 'zoom-in',
                }}
              >
                <img
                  src={activeImageUrl}
                  alt={`${photo.name} — evidencia ${activeImageIndex + 1} de ${galleryImages.length}`}
                  className="w-full h-full object-contain max-h-[720px] rounded"
                />
              </button>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#a7c8da] bg-white/70 px-6 text-center" role="status">
                <span className="material-symbols-outlined grid h-14 w-14 place-items-center rounded-full bg-[#e6f6ff] text-[30px] text-[#607d8b]">hide_image</span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-[#355a70]">Sin evidencia</p>
                  <p className="mt-1 text-xs leading-5 text-[#607d8b]">Este elemento no tiene fotos disponibles en su galería.</p>
                </div>
              </div>
            )}

            {hasMultipleImages && (
              <>
                <button type="button" onClick={showPreviousImage} className="absolute left-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[#9fc2d2] bg-white/90 text-[#073f74] shadow-lg transition hover:bg-white" title="Foto anterior" aria-label="Foto anterior">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button type="button" onClick={showNextImage} className="absolute right-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[#9fc2d2] bg-white/90 text-[#073f74] shadow-lg transition hover:bg-white" title="Foto siguiente" aria-label="Foto siguiente">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </>
            )}

            {/* Image Overlay Controls */}
            {hasEvidence && <div className="absolute top-4 right-4 flex items-center gap-2 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#f3faff]/80 backdrop-blur-xs p-1 rounded-full border border-[#c2c6d4]">
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#071e27] hover:bg-[#cfe6f2] transition-colors"
                title="Acercar (Zoom In)"
              >
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
              {zoomLevel > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#071e27] hover:bg-[#cfe6f2] transition-colors"
                    title="Alejar (Zoom Out)"
                  >
                    <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2 h-8 rounded-full flex items-center justify-center text-[#071e27] hover:bg-[#cfe6f2] text-[11px] font-bold"
                    title="Restablecer Escala"
                  >
                    {zoomLevel}x
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => openImageFullscreen(activeImageIndex)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#071e27] hover:bg-[#cfe6f2] transition-colors"
                title="Pantalla Completa"
              >
                <span className="material-symbols-outlined text-[18px]">fullscreen</span>
              </button>
            </div>}
          </div>

          <div className="border-t border-[#c2c6d4] bg-white px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold tracking-wide text-[#527284]">{hasEvidence ? `EVIDENCIAS · ${activeImageIndex + 1}/${galleryImages.length}` : 'SIN EVIDENCIA'}</span>
              {hasMultipleImages && <span className="text-[10px] text-[#607d8b]">Selecciona una miniatura para ampliar</span>}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {!hasEvidence && <span className="rounded-md border border-dashed border-[#a7c8da] bg-[#f3faff] px-2.5 py-2 text-[10px] font-medium text-[#607d8b]">No hay miniaturas disponibles.</span>}
              {galleryImages.map((imageUrl, index) => (
                <button
                  key={`${imageUrl.slice(0, 32)}-${index}`}
                  type="button"
                  onClick={() => openImageFullscreen(index)}
                  className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-md border-2 transition ${index === activeImageIndex ? 'border-[#0566aa] ring-2 ring-cyan-200' : 'border-transparent hover:border-[#9fc2d2]'}`}
                  title={`Abrir evidencia ${index + 1} a pantalla completa`}
                  aria-label={`Abrir evidencia ${index + 1} a pantalla completa`}
                >
                  <img src={imageUrl} alt={`Miniatura de evidencia ${index + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 right-0 bg-[#073f74]/85 px-1 text-[9px] font-bold text-white">{index + 1}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Context Bar */}
          <div className="p-4 border-t border-[#c2c6d4] bg-[#f3faff] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                photo.status === 'Synced'
                  ? 'bg-[#a3f69c] ring-2 ring-[#a0f399]/50 animate-pulse'
                  : photo.status === 'Flagged'
                  ? 'bg-[#ffdad6] ring-2 ring-[#ba1a1a]/50'
                  : 'bg-[#cfe6f2]'
              }`}></span>
              <span className="font-['Inter'] font-bold text-[14px] text-[#424752]">
                {photo.status === 'Synced' ? 'Sincronizado en la Nube' : photo.status === 'Flagged' ? 'Inspección con Alerta' : 'Sincronización en Progreso'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className="font-['Inter'] text-[14px] text-[#424752] hover:text-[#004d99] flex items-center gap-1.5 transition-colors"
              title="Copiar ID de Inspección"
            >
              <span>ID: {photo.displayId}</span>
              <span className="material-symbols-outlined text-[15px]">
                {copiedId ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Properties Panel */}
        <div className="w-full lg:w-96 bg-[#f3faff] border border-[#c2c6d4] rounded-xl shadow-xs flex flex-col h-fit flex-shrink-0">
          {/* Panel Header */}
          <div className="p-6 border-b border-[#c2c6d4] bg-white rounded-t-xl">
            <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-[#071e27] mb-3 leading-snug">
              {photo.name}
            </h1>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Execution Status Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-['Inter'] font-bold text-[12px] ${
                  currentExecutionStatus === 'Terminado'
                    ? 'bg-[#a0f399] text-[#217128]'
                    : 'bg-[#fef3c7] text-[#92400e]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {currentExecutionStatus === 'Terminado' ? 'task_alt' : 'pending_actions'}
                </span>
                {currentExecutionStatus}
              </span>

              {/* Verification Toggle Badge */}
              <button
                type="button"
                onClick={handleToggleVerified}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-['Inter'] font-medium text-[12px] transition-colors ${
                  photo.verified
                    ? 'bg-[#cfe6f2] text-[#004d99] hover:bg-[#b8dcf0]'
                    : 'bg-[#f0f2f5] text-[#727783] hover:bg-[#e4e7eb]'
                }`}
                title="Haz clic para alternar el estado de verificación"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {photo.verified ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                {photo.verified ? 'Verificado' : 'Sin Verificar'}
              </button>

              {/* Tramo Badge if defined */}
              {elementType === 'tuberia' && photo.tramo && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#004d99]/15 text-[#004d99] font-['Inter'] font-bold text-[12px] border border-[#004d99]/30">
                  <span className="material-symbols-outlined text-[14px]">plumbing</span>
                  Tramo: {photo.tramo}
                </span>
              )}

              {/* Metraje Badge if defined */}
              {elementType === 'tuberia' && photo.metraje && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1b6d24]/15 text-[#1b6d24] font-['Inter'] font-bold text-[12px] border border-[#1b6d24]/30">
                  <span className="material-symbols-outlined text-[14px]">straighten</span>
                  {photo.metraje} m
                </span>
              )}

              {/* Sector Badge */}
              {(() => {
                const sec = getElementSector(photo.name);
                return (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-['Inter'] font-bold text-[12px] border ${sec.badgeClass}`}>
                    <span className="material-symbols-outlined text-[14px]">share_location</span>
                    {sec.label} ({sec.code})
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Properties List (Inspection Style) */}
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
            {/* Section 1: Metadata */}
            <div className="space-y-3.5">
              <h3 className="font-['Inter'] font-medium text-[12px] text-[#727783] uppercase tracking-wider bg-[#cfe6f2] p-2 rounded-lg w-full">
                Metadatos y Propiedades
              </h3>

              {/* Property: Sector */}
              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Sector
                </span>
                <div className="col-span-2">
                  {(() => {
                    const sec = getElementSector(photo.name);
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[13px] font-bold border ${sec.badgeClass}`}>
                          <span className="material-symbols-outlined text-[15px]">share_location</span>
                          {sec.label}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-[#555] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Código: {sec.code}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Property: Estado (En proceso / Terminado) */}
              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Estado
                </span>
                <div className="col-span-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleExecutionStatus('En proceso')}
                    className={`px-2.5 py-1 rounded text-[12px] font-bold transition-all flex items-center gap-1 ${
                      currentExecutionStatus === 'En proceso'
                        ? 'bg-[#f59e0b] text-white shadow-xs'
                        : 'bg-[#e6f6ff] text-[#424752] hover:bg-[#dbf1fe]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">pending_actions</span>
                    En proceso
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleExecutionStatus('Terminado')}
                    className={`px-2.5 py-1 rounded text-[12px] font-bold transition-all flex items-center gap-1 ${
                      currentExecutionStatus === 'Terminado'
                        ? 'bg-[#16a34a] text-white shadow-xs'
                        : 'bg-[#e6f6ff] text-[#424752] hover:bg-[#dbf1fe]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    Terminado
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Tipo
                </span>
                <span className="col-span-2 font-['Inter'] text-[14px] text-[#071e27]">
                  {photo.type || photo.categoryLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Fecha Captura
                </span>
                <span className="col-span-2 font-['Inter'] text-[14px] text-[#071e27]">
                  {photo.date}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Ubicación
                </span>
                <span className="col-span-2 font-['Inter'] text-[14px] text-[#071e27] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-[#004d99]">
                    location_on
                  </span>
                  <span className="truncate">{photo.location}</span>
                </span>
              </div>

              {elementType === 'camara' && (
                <>
              {/* Camera Model & System Type */}
              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Cámara
                </span>
                <div className="col-span-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#004d99]/10 text-[#004d99] font-bold text-[12px] border border-[#004d99]/20">
                    <span className="material-symbols-outlined text-[14px]">videocam</span>
                    {photo.cameraCode || 'SB850'}
                  </span>
                  {photo.cameraType && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] ${
                      photo.cameraType === 'MT'
                        ? 'bg-sky-100 text-sky-800 border border-sky-300'
                        : photo.cameraType === 'BT'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-purple-100 text-purple-800 border border-purple-300'
                    }`}>
                      <span className="material-symbols-outlined text-[12px]">
                        {photo.cameraType === 'MT' ? 'bolt' : photo.cameraType === 'BT' ? 'electric_bolt' : 'lan'}
                      </span>
                      {photo.cameraType}
                    </span>
                  )}
                </div>
              </div>

                </>
              )}
              {elementType === 'tuberia' && (
                <>
              {/* Tramo / Tubería Property */}
              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Tramo Tubería
                </span>
                <div className="col-span-2 flex items-center gap-2">
                  {photo.tramo ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#004d99] text-white font-['Hanken_Grotesk'] font-bold text-[13px] shadow-xs">
                      <span className="material-symbols-outlined text-[15px]">plumbing</span>
                      {photo.tramo}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[#727783] italic">
                      No especificado
                    </span>
                  )}
                </div>
              </div>

              {/* Metraje / Longitud Property */}
              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Metraje (Longitud)
                </span>
                <div className="col-span-2 flex items-center gap-2 flex-wrap">
                  {photo.metraje ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1b6d24] text-white font-['Hanken_Grotesk'] font-bold text-[13px] shadow-xs">
                        <span className="material-symbols-outlined text-[15px]">straighten</span>
                        {photo.metraje} metros
                      </span>
                      {photo.tramo && (
                        <span className="text-[12px] text-[#1b6d24] font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {(() => {
                            const match = photo.tramo.match(/^(\d+)x/);
                            const q = match ? parseInt(match[1], 10) : 1;
                            const m = parseFloat(String(photo.metraje));
                            if (q > 1 && !isNaN(m)) {
                              return `Total: ${(q * m).toFixed(1).replace(/\.0$/, '')} m lineales (${q} tubos × ${m}m)`;
                            }
                            return null;
                          })()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[13px] text-[#727783] italic">
                      No especificado
                    </span>
                  )}
                </div>
              </div>

                </>
              )}
              {/* Ubicación relativa en plano */}
              <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Ubicación en plano
                </span>
                <div className="col-span-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#e6f6ff] text-[#004d99] font-mono text-[12px] border border-[#c2c6d4]">
                    <span className="material-symbols-outlined text-[14px]">ads_click</span>
                    {typeof photo.planX === 'number' && typeof photo.planY === 'number'
                      ? `Punto: ${photo.planX.toFixed(1)}%, ${photo.planY.toFixed(1)}%`
                      : 'Pendiente de ubicar en el plano'}
                  </span>
                  {onBackToMap && (
                    <button
                      type="button"
                      onClick={onBackToMap}
                      className="px-2.5 py-1 bg-[#004d99] hover:bg-[#003870] text-white text-[11px] font-bold rounded-md flex items-center gap-1 shadow-2xs transition-colors"
                      title="Ver en el plano"
                    >
                      <span className="material-symbols-outlined text-[13px]">explore</span>
                      Ver en plano
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 items-start border-b border-[#c2c6d4] pb-3">
                <span className="col-span-1 font-['Inter'] font-bold text-[14px] text-[#424752] mt-1">
                  Inspector
                </span>
                <div className="col-span-2 flex items-center gap-2">
                  <img
                    src={photo.inspectorAvatar}
                    alt={photo.inspectorName}
                    className="w-6 h-6 rounded-full object-cover border border-[#c2c6d4]"
                  />
                  <span className="font-['Inter'] text-[14px] text-[#071e27]">
                    {photo.inspectorName} (ID: {photo.inspectorId})
                  </span>
                </div>
              </div>

              {photo.resolution && (
                <div className="grid grid-cols-3 gap-2 items-center border-b border-[#c2c6d4] pb-3 text-[12px] text-[#727783]">
                  <span className="col-span-1 font-bold">Detalles</span>
                  <span className="col-span-2">{photo.resolution} • {photo.fileSize}</span>
                </div>
              )}
            </div>

            {/* Section 2: Findings */}
            <div className="space-y-3.5">
              <h3 className="font-['Inter'] font-medium text-[12px] text-[#727783] uppercase tracking-wider bg-[#cfe6f2] p-2 rounded-lg w-full">
                Hallazgos y Observaciones
              </h3>

              <div className="flex flex-col gap-2">
                <label className="font-['Inter'] font-bold text-[14px] text-[#424752]">
                  Notas de Campo
                </label>
                <p className="font-['Inter'] text-[14px] leading-relaxed text-[#071e27] bg-[#e6f6ff] p-3.5 rounded-lg border border-[#c2c6d4] min-h-[80px]">
                  {photo.fieldNotes || 'Sin notas registradas en esta inspección.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <label className="font-['Inter'] font-bold text-[14px] text-[#424752]">
                  ¿Requiere Acción Inmediata?
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleToggleActionRequired(true)}
                    className={`px-4 py-2 rounded font-['Inter'] font-bold text-[14px] transition-all ${
                      photo.requiresImmediateAction
                        ? 'bg-[#ba1a1a] text-white shadow-xs'
                        : 'bg-[#ECEFF1] border border-[#c2c6d4] text-[#424752] opacity-60 hover:opacity-100'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActionRequired(false)}
                    className={`px-4 py-2 rounded font-['Inter'] font-bold text-[14px] flex items-center gap-1 transition-all ${
                      !photo.requiresImmediateAction
                        ? 'bg-[#1b6d24] text-white shadow-xs'
                        : 'bg-[#ECEFF1] border border-[#c2c6d4] text-[#424752] opacity-60 hover:opacity-100'
                    }`}
                  >
                    {!photo.requiresImmediateAction && (
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    )}
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Panel Actions (Bottom Sticky) */}
          <div className="p-6 border-t border-[#c2c6d4] bg-white rounded-b-xl flex flex-col gap-2.5 mt-auto">
            {onBackToMap && (
              <button
                type="button"
                onClick={onBackToMap}
                className="w-full py-3 px-4 bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#004d99] border border-[#004d99]/30 rounded-lg font-['Inter'] font-bold text-[14px] flex items-center justify-center gap-2 transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[18px]">map</span>
                {originTab === 'map' ? 'Regresar al Plano de Obra' : 'Ver y centrar en el plano'}
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(photo)}
              className="w-full py-3 px-4 bg-[#004d99] text-white rounded-lg font-['Inter'] font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-[#1565c0] transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Editar Detalles
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 px-4 bg-[#f3faff] text-[#ba1a1a] border border-[#ba1a1a]/40 rounded-lg font-['Inter'] font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[#ffdad6] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Eliminar Foto
            </button>
          </div>
        </div>
      </div>

      <section aria-labelledby="photo-timeline-title" className="overflow-hidden rounded-xl border border-[#c2c6d4] bg-white shadow-xs">
        <div className="flex flex-col gap-2 border-b border-[#d7e3e8] bg-[#f3faff] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-[#0566aa]">AVANCE DOCUMENTADO</p>
            <h2 id="photo-timeline-title" className="mt-1 text-base font-bold text-[#0b2940]">Historial fotográfico</h2>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#b7d7e6] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#285b72]">
            <span className="material-symbols-outlined text-[15px]">photo_library</span>
            {evidenceTimeline.length} evidencia{evidenceTimeline.length === 1 ? '' : 's'}
          </span>
        </div>

        {timelineGroups.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-[#607d8b]">
            <span className="material-symbols-outlined grid h-10 w-10 place-items-center rounded-full bg-[#f3faff] text-[21px]">history_toggle_off</span>
            <p>Aún no hay fotos para construir el avance cronológico de este elemento.</p>
          </div>
        ) : (
          <div className="space-y-6 px-5 py-5">
            <figure aria-labelledby="graphic-evolution-title" className="overflow-hidden rounded-xl border border-[#b7d7e6] bg-[linear-gradient(135deg,#f8fcfe_0%,#edf7fb_100%)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#d5e6ee] bg-white/80 px-3 py-2.5">
                <div>
                  <p className="font-mono text-[9px] font-bold tracking-[0.12em] text-[#0566aa]">EVOLUCIÓN VISUAL</p>
                  <h3 id="graphic-evolution-title" className="mt-0.5 text-sm font-bold text-[#0b2940]">Ruta gráfica del avance</h3>
                </div>
                <span className="material-symbols-outlined text-[22px] text-[#0b5d8c]" aria-hidden="true">insights</span>
              </div>
              <div className="overflow-x-auto px-2 py-3" aria-label="Línea de tiempo gráfica de evidencias">
                <div className="relative h-[13.5rem]" style={{ width: `${graphicalTimelineWidth}px` }}>
                  <svg viewBox={`0 0 ${graphicalTimelineWidth} 200`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                    <polyline
                      points={graphicalTimelinePoints.map((point) => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke="#527f96"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {graphicalTimelinePoints.map((point) => (
                      <g key={`graphic-node-${point.originalIndex}`}>
                        <circle cx={point.x} cy={point.y} r="7" fill="#ffffff" stroke="#0b5d8c" strokeWidth="3" />
                        <circle cx={point.x} cy={point.y} r="2.5" fill="#00a8c6" />
                      </g>
                    ))}
                  </svg>
                  {graphicalTimelinePoints.map((point) => (
                    <button
                      key={`graphic-evidence-${point.originalIndex}`}
                      type="button"
                      onClick={() => openImageFullscreen(point.originalIndex)}
                      aria-label={`Abrir hito de evolución del ${formatGraphicTimelineDate(point.capturedAt)}`}
                      className="group absolute z-10 flex w-[5.25rem] -translate-x-1/2 flex-col items-center text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0566aa] focus-visible:ring-offset-2"
                      style={{ left: `${point.x}px`, top: `${Math.max(10, point.y - 88)}px` }}
                    >
                      <span className="relative block w-[4.6rem] overflow-hidden rounded-md border-2 border-white bg-white p-1 shadow-[0_5px_14px_rgba(7,63,116,0.24)] transition duration-200 group-hover:-translate-y-1 group-hover:border-[#56b5cd]">
                        <img src={point.url} alt={`Hito fotográfico de ${formatGraphicTimelineDate(point.capturedAt)}`} className="h-14 w-full object-cover" />
                        <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white bg-white" aria-hidden="true" />
                      </span>
                      <time dateTime={point.capturedAt} className="mt-3 max-w-full truncate rounded-full bg-white/85 px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#315c70]">
                        {formatGraphicTimelineDate(point.capturedAt)}
                      </time>
                    </button>
                  ))}
                </div>
              </div>
              <figcaption className="border-t border-[#d5e6ee] bg-white/70 px-3 py-2 text-[10px] leading-4 text-[#527284]">Cada hito representa una evidencia registrada. Selecciónalo para abrir la foto y revisar su avance.</figcaption>
            </figure>
            {timelineGroups.map((group) => (
              <div key={group.day} className="relative pl-8">
                <span className="absolute left-[7px] top-2 h-full w-px bg-[#b7d7e6]" aria-hidden="true" />
                <span className="absolute left-0 top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[#0566aa] shadow-sm" aria-hidden="true" />
                <time dateTime={group.day} className="mb-3 block text-xs font-bold capitalize text-[#0b4f7a]">{formatTimelineDay(group.day)}</time>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.entries.map((entry, entryIndex) => {
                    const duplicateOrdinal = group.entries
                      .slice(0, entryIndex)
                      .filter((candidate) => candidate.url === entry.url && candidate.capturedAt === entry.capturedAt)
                      .length;
                    let matchedOccurrences = 0;
                    const imageIndex = evidenceTimeline.findIndex((candidate) => {
                      if (candidate.url !== entry.url || candidate.capturedAt !== entry.capturedAt) return false;
                      const isRequestedOccurrence = matchedOccurrences === duplicateOrdinal;
                      matchedOccurrences += 1;
                      return isRequestedOccurrence;
                    });
                    return (
                      <button
                        key={`${group.day}-${entryIndex}`}
                        type="button"
                        onClick={() => openImageFullscreen(Math.max(0, imageIndex))}
                        className="group flex overflow-hidden rounded-lg border border-[#c7dce5] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0566aa] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0566aa] focus-visible:ring-offset-2"
                        aria-label={`Abrir evidencia tomada a las ${formatTimelineTime(entry.capturedAt)}`}
                      >
                        <img src={entry.url} alt={`Evidencia de avance del ${formatTimelineDay(group.day)}`} className="h-20 w-24 shrink-0 object-cover" />
                        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#0566aa]"><span className="material-symbols-outlined text-[14px]">schedule</span>{formatTimelineTime(entry.capturedAt)}</span>
                          <span className="truncate text-xs font-semibold text-[#24485b]">Evidencia de avance</span>
                          <span className="text-[10px] text-[#607d8b]">Abrir en visor</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fullscreen Lightbox Modal */}
      {isFullscreen && hasEvidence && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center text-white pb-3 border-b border-white/20">
            <div>
              <h3 className="font-['Hanken_Grotesk'] font-bold text-lg">{photo.name}</h3>
              <p className="text-[12px] text-gray-300">{photo.displayId} • {photo.location} • Foto {activeImageIndex + 1} de {galleryImages.length}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2 text-white hover:text-red-400 rounded-lg"
              title="Cerrar vista completa"
            >
              <span className="material-symbols-outlined text-[28px]">close</span>
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-4">
            {hasMultipleImages && (
              <button type="button" onClick={showPreviousImage} className="absolute left-4 z-10 grid h-12 w-12 place-items-center rounded-full border border-white/35 bg-black/40 text-white transition hover:bg-black/70" title="Foto anterior" aria-label="Foto anterior">
                <span className="material-symbols-outlined text-[30px]">chevron_left</span>
              </button>
            )}
            <img
              src={activeImageUrl}
              alt={`${photo.name} — evidencia ${activeImageIndex + 1} de ${galleryImages.length}`}
              className="max-w-full max-h-[85vh] object-contain"
            />
            {hasMultipleImages && (
              <button type="button" onClick={showNextImage} className="absolute right-4 z-10 grid h-12 w-12 place-items-center rounded-full border border-white/35 bg-black/40 text-white transition hover:bg-black/70" title="Foto siguiente" aria-label="Foto siguiente">
                <span className="material-symbols-outlined text-[30px]">chevron_right</span>
              </button>
            )}
          </div>
          {hasMultipleImages && (
            <div className="flex justify-center gap-2 overflow-x-auto border-t border-white/15 px-4 py-3">
              {galleryImages.map((imageUrl, index) => (
                <button key={`${imageUrl.slice(0, 32)}-fullscreen-${index}`} type="button" onClick={() => setActiveImageIndex(index)} className={`h-12 w-14 shrink-0 overflow-hidden rounded border-2 transition ${index === activeImageIndex ? 'border-cyan-300' : 'border-transparent opacity-65 hover:opacity-100'}`} title={`Ver foto ${index + 1}`} aria-label={`Ver foto ${index + 1}`}>
                  <img src={imageUrl} alt={`Miniatura de evidencia ${index + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#c2c6d4] shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#ba1a1a] mb-3">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="font-['Hanken_Grotesk'] font-bold text-xl text-[#071e27]">
                ¿Eliminar Foto de Inspección?
              </h3>
            </div>
            <p className="text-[14px] text-[#424752] mb-4">
              ¿Estás seguro de que deseas eliminar permanentemente <strong>{photo.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-[#c2c6d4] text-[#424752] font-bold text-[13px] rounded-lg hover:bg-[#e6f6ff]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(photo.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-[#ba1a1a] text-white font-bold text-[13px] rounded-lg hover:bg-[#93000a]"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
