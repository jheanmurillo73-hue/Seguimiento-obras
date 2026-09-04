import React, { useState } from 'react';
import { InspectionPhoto, SyncStatus, ExecutionStatus, InspectorProfile } from '../types';
import { ObraControlDashboard } from './ObraControlDashboard';

interface DashboardViewProps {
  photos: InspectionPhoto[];
  inspector?: InspectorProfile;
  onSelectPhoto: (photo: InspectionPhoto) => void;
  onUpdatePhotoTitle: (id: string, newTitle: string) => void;
  onDeletePhoto: (id: string) => void;
  onNavigateToUpload: () => void;
  onNavigateToMap?: (photo?: InspectionPhoto) => void;
  onOpenSupabaseModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  photos,
  inspector,
  onSelectPhoto,
  onUpdatePhotoTitle,
  onDeletePhoto,
  onNavigateToUpload,
  onNavigateToMap,
  onOpenSupabaseModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'control_obra' | 'galeria'>('control_obra');
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [photoToDelete, setPhotoToDelete] = useState<InspectionPhoto | null>(null);

  const filteredPhotos = photos.filter((photo) => {
    const execStatus: ExecutionStatus = photo.executionStatus || 'En proceso';

    const matchesFilter =
      filter === 'all' ||
      (filter === 'completed' && execStatus === 'Terminado') ||
      (filter === 'in_progress' && execStatus === 'En proceso') ||
      (filter === 'synced' && photo.status === 'Synced') ||
      (filter === 'flagged' && photo.status === 'Flagged') ||
      (filter === 'hazards' && photo.requiresImmediateAction);

    const matchesSearch =
      photo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      photo.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (photo.cameraCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (photo.cameraType || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (photo.tramo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (photo.metraje ? `${photo.metraje}m` : '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (photo.metraje ? String(photo.metraje) : '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      photo.displayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      photo.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execStatus.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const getExecutionBadge = (status?: ExecutionStatus) => {
    const isCompleted = status === 'Terminado';
    return (
      <span
        className={`px-2 py-0.5 rounded font-['Inter'] font-bold text-[11px] flex items-center gap-1 ${
          isCompleted
            ? 'bg-[#a0f399] text-[#217128]'
            : 'bg-[#fef3c7] text-[#92400e]'
        }`}
      >
        <span className="material-symbols-outlined text-[13px]">
          {isCompleted ? 'check_circle' : 'pending_actions'}
        </span>
        {status || 'En proceso'}
      </span>
    );
  };

  const getStatusBadge = (status: SyncStatus) => {
    switch (status) {
      case 'Synced':
        return (
          <span className="bg-[#cfe6f2] text-[#004d99] px-2 py-0.5 rounded font-['Inter'] font-medium text-[11px]">
            Sincronizado
          </span>
        );
      case 'In Progress':
        return (
          <span className="bg-[#e6f6ff] text-[#424752] px-2 py-0.5 rounded font-['Inter'] font-medium text-[11px]">
            Sincronizando
          </span>
        );
      case 'Flagged':
        return (
          <span className="bg-[#ffdad6] text-[#93000a] px-2 py-0.5 rounded font-['Inter'] font-medium text-[11px]">
            Alerta
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto w-full space-y-6">
      {/* Top View Selector Bar: Control de Obra (Power BI) vs Galería Reciente */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 sm:p-2.5 rounded-2xl border border-[#c2c6d4] shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-[#f1f5f9] rounded-xl border border-[#cbd5e1] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('control_obra')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'control_obra'
                ? 'bg-[#004d99] text-white shadow-xs'
                : 'text-[#334155] hover:bg-white hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            <span>Control de Obra (Power BI)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
              Nuevo
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('galeria')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'galeria'
                ? 'bg-[#004d99] text-white shadow-xs'
                : 'text-[#334155] hover:bg-white hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
            <span>Galería de Fotos ({photos.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="bg-[#004d99] hover:bg-[#00468c] text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Subir Nueva Foto
          </button>
        </div>
      </div>

      {/* Renderizar según la pestaña activa */}
      {activeSubTab === 'control_obra' ? (
        <ObraControlDashboard
          photos={photos}
          inspector={inspector}
          onSelectPhoto={onSelectPhoto}
          onNavigateToMap={onNavigateToMap || (() => {})}
          onNavigateToUpload={onNavigateToUpload}
          onOpenSupabaseModal={onOpenSupabaseModal}
        />
      ) : (
        <>
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="font-['Hanken_Grotesk'] text-2xl sm:text-[32px] font-bold text-[#071e27] leading-tight">
                Cargas Recientes
              </h1>
              <p className="font-['Inter'] text-[14px] text-[#424752] mt-1.5">
                Gestiona y revisa fotos recientes de inspección con control de estado (En proceso / Terminado).
              </p>
            </div>
          </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-white p-3 rounded-xl border border-[#c2c6d4]">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-[#004d99] text-white'
                : 'text-[#424752] hover:bg-[#e6f6ff]'
            }`}
          >
            Todas ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('in_progress')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'in_progress'
                ? 'bg-[#f59e0b] text-white'
                : 'text-[#424752] hover:bg-[#e6f6ff]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">pending_actions</span>
            En proceso
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'completed'
                ? 'bg-[#16a34a] text-white'
                : 'text-[#424752] hover:bg-[#e6f6ff]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">check_circle</span>
            Terminados
          </button>
          <button
            type="button"
            onClick={() => setFilter('synced')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'synced'
                ? 'bg-[#004d99] text-white'
                : 'text-[#424752] hover:bg-[#e6f6ff]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#a0f399]"></span>
            Sincronizadas
          </button>
          <button
            type="button"
            onClick={() => setFilter('flagged')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'flagged'
                ? 'bg-[#ba1a1a] text-white'
                : 'text-[#424752] hover:bg-[#e6f6ff]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#ffdad6]"></span>
            Marcadas
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#727783] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, estado, ubicación..."
            className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-lg pl-9 pr-3 py-1.5 text-[13px] text-[#071e27] placeholder-[#727783] focus:border-[#004d99] focus:outline-none focus:ring-1 focus:ring-[#004d99]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#727783] hover:text-[#071e27]"
              title="Limpiar búsqueda"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredPhotos.length === 0 && (
        <div className="bg-white rounded-xl border border-[#c2c6d4] p-12 text-center my-6">
          <span className="material-symbols-outlined text-5xl text-[#727783] mb-3">
            photo_library
          </span>
          <h3 className="font-['Hanken_Grotesk'] font-bold text-lg text-[#071e27]">
            No se encontraron fotos de inspección
          </h3>
          <p className="text-[14px] text-[#424752] mt-1 max-w-md mx-auto">
            {searchQuery
              ? `Ningún resultado coincide con tu búsqueda "${searchQuery}". Prueba con otro término.`
              : 'No hay fotos de inspección en esta categoría actualmente.'}
          </p>
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="mt-4 bg-[#004d99] text-white px-4 py-2 rounded-lg font-bold text-[13px] inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
            Subir Nueva Foto
          </button>
        </div>
      )}

      {/* Bento Grid Gallery */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredPhotos.map((photo) => (
          <div
            key={photo.id}
            className="bg-[#f3faff] rounded-xl border border-[#c2c6d4] overflow-hidden group hover:border-[#004d99] hover:shadow-md transition-all flex flex-col cursor-pointer"
          >
            {/* Image Thumbnail Container */}
            <div
              className="aspect-square relative overflow-hidden bg-[#cfe6f2]"
              onClick={() => onSelectPhoto(photo)}
            >
              <img
                src={photo.imageUrl}
                alt={photo.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Top Right Quick Delete Icon */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoToDelete(photo);
                }}
                className="absolute top-2 right-2 bg-white/90 backdrop-blur-xs rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:scale-110 shadow-xs"
                title="Eliminar foto"
              >
                <span className="material-symbols-outlined text-[#ba1a1a] text-[18px] block">
                  close
                </span>
              </button>

              {/* Bottom Left Quick ID Pill */}
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[11px] font-mono px-2 py-0.5 rounded">
                {photo.displayId}
              </div>

              {/* Hazard indicator badge if applicable */}
              {photo.requiresImmediateAction && (
                <div className="absolute top-2 left-2 bg-[#ba1a1a] text-white text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-xs">
                  <span className="material-symbols-outlined text-[13px]">warning</span>
                  Riesgo
                </div>
              )}
            </div>

            {/* Photo Details & Title Input */}
            <div className="p-4 flex flex-col gap-2 flex-1 justify-between bg-[#f3faff]">
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={photo.name ?? ''}
                  onChange={(e) => onUpdatePhotoTitle(photo.id, e.target.value)}
                  className="w-full font-['Inter'] font-bold text-[14px] text-[#071e27] bg-transparent border-b border-[#c2c6d4] focus:border-[#004d99] focus:outline-none px-0 py-1 transition-colors"
                  placeholder="Nombre de la foto"
                  title="Haz clic para renombrar en el lugar"
                />
                <div className="text-[12px] text-[#727783] flex items-center justify-between gap-1 mt-1 truncate">
                  <div className="flex items-center gap-1 truncate">
                    <span className="material-symbols-outlined text-[13px] text-[#004d99]">location_on</span>
                    <span className="truncate font-semibold text-[#071e27]">{photo.location}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                    {photo.tramo && (
                      <span className="bg-[#004d99] text-white font-bold text-[10px] px-1.5 py-0.2 rounded flex items-center gap-0.5 shadow-2xs" title={`Tramo: ${photo.tramo}`}>
                        <span className="material-symbols-outlined text-[10px]">plumbing</span>
                        {photo.tramo}
                      </span>
                    )}
                    {photo.metraje && (
                      <span className="bg-[#1b6d24] text-white font-bold text-[10px] px-1.5 py-0.2 rounded flex items-center gap-0.5 shadow-2xs" title={`Metraje: ${photo.metraje} m`}>
                        <span className="material-symbols-outlined text-[10px]">straighten</span>
                        {photo.metraje}m
                      </span>
                    )}
                    <span className="bg-[#004d99]/10 text-[#004d99] font-bold text-[10px] px-1.5 py-0.2 rounded">
                      {photo.cameraCode || 'SB850'}
                    </span>
                    {photo.cameraType && (
                      <span className={`font-bold text-[10px] px-1 py-0.2 rounded ${
                        photo.cameraType === 'MT'
                          ? 'bg-sky-100 text-sky-800'
                          : photo.cameraType === 'BT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {photo.cameraType}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="flex justify-between items-center mt-2 pt-2 border-t border-[#dbf1fe]"
                onClick={() => onSelectPhoto(photo)}
              >
                <span className="font-['Inter'] text-[12px] text-[#424752]">
                  {photo.date.split(',')[0]}
                </span>
                <div className="flex items-center gap-1.5">
                  {getExecutionBadge(photo.executionStatus)}
                  {getStatusBadge(photo.status)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {photoToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#c2c6d4] shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#ba1a1a] mb-3">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="font-['Hanken_Grotesk'] font-bold text-xl text-[#071e27]">
                ¿Eliminar Foto de Inspección?
              </h3>
            </div>
            <p className="text-[14px] text-[#424752] mb-4">
              ¿Estás seguro de que deseas eliminar <strong>{photoToDelete.name}</strong> ({photoToDelete.displayId})? Esta acción eliminará permanentemente los metadatos y registros asociados.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                className="px-4 py-2 border border-[#c2c6d4] text-[#424752] font-bold text-[13px] rounded-lg hover:bg-[#e6f6ff]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePhoto(photoToDelete.id);
                  setPhotoToDelete(null);
                }}
                className="px-4 py-2 bg-[#ba1a1a] text-white font-bold text-[13px] rounded-lg hover:bg-[#93000a]"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
