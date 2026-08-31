import React, { useState, useMemo } from 'react';
import { InspectionPhoto, ExecutionStatus, SyncStatus } from '../types';

interface HistoryViewProps {
  photos: InspectionPhoto[];
  onSelectPhoto: (photo: InspectionPhoto) => void;
  onUpdatePhoto: (updated: InspectionPhoto) => void;
  onDeletePhoto: (id: string) => void;
  onNavigateToUpload: () => void;
}

type GroupByOption = 'date' | 'location' | 'status';
type SortOrder = 'desc' | 'asc';
type ViewMode = 'cards' | 'table';

export const HistoryView: React.FC<HistoryViewProps> = ({
  photos,
  onSelectPhoto,
  onUpdatePhoto,
  onDeletePhoto,
  onNavigateToUpload,
}) => {
  const [groupBy, setGroupBy] = useState<GroupByOption>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [photoToDelete, setPhotoToDelete] = useState<InspectionPhoto | null>(null);

  // Extract all unique locations for the filter
  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    photos.forEach((p) => {
      if (p.location) locSet.add(p.location.trim());
    });
    return Array.from(locSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [photos]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      const execStatus = photo.executionStatus || 'En proceso';

      // Status filter
      if (statusFilter === 'in_progress' && execStatus !== 'En proceso') return false;
      if (statusFilter === 'completed' && execStatus !== 'Terminado') return false;
      if (statusFilter === 'flagged' && photo.status !== 'Flagged') return false;

      // Location filter
      if (selectedLocation !== 'all' && photo.location.trim() !== selectedLocation) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = photo.name.toLowerCase().includes(query);
        const matchesId = photo.displayId.toLowerCase().includes(query);
        const matchesLoc = photo.location.toLowerCase().includes(query);
        const matchesCameraCode = (photo.cameraCode || '').toLowerCase().includes(query);
        const matchesCameraType = (photo.cameraType || '').toLowerCase().includes(query);
        const matchesTramo = (photo.tramo || '').toLowerCase().includes(query);
        const matchesMetraje = (photo.metraje ? `${photo.metraje}m ${photo.metraje} metros` : '').toLowerCase().includes(query);
        const matchesType = (photo.type || photo.categoryLabel).toLowerCase().includes(query);
        const matchesInspector = photo.inspectorName.toLowerCase().includes(query);
        const matchesNotes = (photo.fieldNotes || '').toLowerCase().includes(query);
        const matchesDate = photo.date.toLowerCase().includes(query);
        const matchesStatus = execStatus.toLowerCase().includes(query);

        if (!matchesName && !matchesId && !matchesLoc && !matchesCameraCode && !matchesCameraType && !matchesTramo && !matchesMetraje && !matchesType && !matchesInspector && !matchesNotes && !matchesDate && !matchesStatus) {
          return false;
        }
      }

      return true;
    });
  }, [photos, statusFilter, selectedLocation, searchQuery]);

  // Group photos according to groupBy
  const groupedData = useMemo(() => {
    const groups: { [key: string]: InspectionPhoto[] } = {};

    filteredPhotos.forEach((photo) => {
      let key = 'Sin clasificar';

      if (groupBy === 'date') {
        // Group by Date string (e.g. YYYY-MM-DD or readable date)
        if (photo.dateRaw) {
          key = photo.dateRaw;
        } else {
          key = photo.date.split(',')[0].trim();
        }
      } else if (groupBy === 'location') {
        key = photo.location.trim() || 'Ubicación Desconocida';
      } else if (groupBy === 'status') {
        key = photo.executionStatus || 'En proceso';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(photo);
    });

    // Sort the group keys
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (groupBy === 'date') {
        return sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
      }
      return sortOrder === 'desc'
        ? b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
        : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    return sortedKeys.map((key) => {
      // Sort items within each group by date/name
      const items = groups[key].sort((p1, p2) => {
        const d1 = p1.dateRaw || p1.date;
        const d2 = p2.dateRaw || p2.date;
        return sortOrder === 'desc' ? d2.localeCompare(d1) : d1.localeCompare(d2);
      });

      // Format human-friendly group title
      let formattedTitle = key;
      if (groupBy === 'date') {
        try {
          const parsed = new Date(key);
          if (!isNaN(parsed.getTime())) {
            formattedTitle = parsed.toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            // Capitalize first letter
            formattedTitle = formattedTitle.charAt(0).toUpperCase() + formattedTitle.slice(1);
          }
        } catch {
          formattedTitle = key;
        }
      }

      return {
        key,
        title: formattedTitle,
        count: items.length,
        items,
        completedCount: items.filter((i) => (i.executionStatus || 'En proceso') === 'Terminado').length,
        inProgressCount: items.filter((i) => (i.executionStatus || 'En proceso') === 'En proceso').length,
      };
    });
  }, [filteredPhotos, groupBy, sortOrder]);

  const handleToggleExecutionStatus = (photo: InspectionPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: ExecutionStatus = photo.executionStatus === 'Terminado' ? 'En proceso' : 'Terminado';
    onUpdatePhoto({
      ...photo,
      executionStatus: nextStatus,
    });
  };

  return (
    <div className="max-w-[1360px] mx-auto w-full space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#c2c6d4] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#004d99] text-3xl">
              history
            </span>
            <h1 className="font-['Hanken_Grotesk'] text-2xl sm:text-[32px] font-bold text-[#071e27] leading-tight">
              Historial de Inspecciones
            </h1>
          </div>
          <p className="font-['Inter'] text-[14px] text-[#424752] mt-1">
            Registro cronológico y territorial de todas las fotos subidas con sus propiedades técnicas y estado de ejecución.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToUpload}
          className="bg-[#004d99] hover:bg-[#00468c] text-white font-['Inter'] font-bold text-[14px] px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-xs"
        >
          <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
          Subir Nueva Foto
        </button>
      </div>

      {/* Control Bar: Classification (Fecha / Ubicación) + Filters + Search */}
      <div className="bg-white p-4 rounded-xl border border-[#c2c6d4] shadow-xs space-y-4">
        {/* Top Row: Classification Selectors & View Mode */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Classification Options (Por Fecha vs Por Ubicación) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-['Inter'] font-bold text-[13px] text-[#071e27] mr-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-[#004d99]">category</span>
              Clasificar por:
            </span>

            {/* Clasificar por Fecha */}
            <button
              type="button"
              onClick={() => setGroupBy('date')}
              className={`px-3.5 py-2 rounded-lg font-['Inter'] font-bold text-[13px] flex items-center gap-1.5 transition-all cursor-pointer ${
                groupBy === 'date'
                  ? 'bg-[#004d99] text-white shadow-xs'
                  : 'bg-[#f3faff] text-[#424752] border border-[#c2c6d4] hover:bg-[#e6f6ff]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">calendar_month</span>
              Por Fecha
            </button>

            {/* Clasificar por Ubicación */}
            <button
              type="button"
              onClick={() => setGroupBy('location')}
              className={`px-3.5 py-2 rounded-lg font-['Inter'] font-bold text-[13px] flex items-center gap-1.5 transition-all cursor-pointer ${
                groupBy === 'location'
                  ? 'bg-[#004d99] text-white shadow-xs'
                  : 'bg-[#f3faff] text-[#424752] border border-[#c2c6d4] hover:bg-[#e6f6ff]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">location_on</span>
              Por Ubicación
            </button>

            {/* Clasificar por Estado */}
            <button
              type="button"
              onClick={() => setGroupBy('status')}
              className={`px-3.5 py-2 rounded-lg font-['Inter'] font-bold text-[13px] flex items-center gap-1.5 transition-all cursor-pointer ${
                groupBy === 'status'
                  ? 'bg-[#004d99] text-white shadow-xs'
                  : 'bg-[#f3faff] text-[#424752] border border-[#c2c6d4] hover:bg-[#e6f6ff]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">task_alt</span>
              Por Estado
            </button>

            {/* Sort direction toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-2 rounded-lg border border-[#c2c6d4] text-[#424752] hover:text-[#004d99] hover:bg-[#f3faff] transition-colors ml-1"
              title={`Orden: ${sortOrder === 'desc' ? 'Descendente' : 'Ascendente'}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
              </span>
            </button>
          </div>

          {/* Right: View layout toggle (Fichas detalladas vs Tabla) */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#727783] hidden sm:inline">Vista:</span>
            <div className="flex bg-[#f3faff] p-1 rounded-lg border border-[#c2c6d4]">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded text-[12px] font-bold flex items-center gap-1 transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-[#004d99] text-white shadow-xs'
                    : 'text-[#424752] hover:bg-[#e6f6ff]'
                }`}
                title="Vista de Fichas de Propiedades"
              >
                <span className="material-symbols-outlined text-[18px]">view_agenda</span>
                <span className="hidden sm:inline">Fichas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-[12px] font-bold flex items-center gap-1 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-[#004d99] text-white shadow-xs'
                    : 'text-[#424752] hover:bg-[#e6f6ff]'
                }`}
                title="Vista de Tabla Comparativa de Propiedades"
              >
                <span className="material-symbols-outlined text-[18px]">table_rows</span>
                <span className="hidden sm:inline">Tabla</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Row: Status Filter + Location Dropdown + Search Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-[#e6f6ff] items-center">
          {/* Status Filter Buttons */}
          <div className="md:col-span-6 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[12px] font-bold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#071e27] text-white'
                  : 'bg-[#f3faff] text-[#424752] hover:bg-[#e6f6ff]'
              }`}
            >
              Todos ({photos.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_progress')}
              className={`px-2.5 py-1 rounded-md text-[12px] font-bold transition-colors flex items-center gap-1 ${
                statusFilter === 'in_progress'
                  ? 'bg-[#f59e0b] text-white'
                  : 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">pending_actions</span>
              En proceso
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-1 rounded-md text-[12px] font-bold transition-colors flex items-center gap-1 ${
                statusFilter === 'completed'
                  ? 'bg-[#16a34a] text-white'
                  : 'bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              Terminados
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('flagged')}
              className={`px-2.5 py-1 rounded-md text-[12px] font-bold transition-colors flex items-center gap-1 ${
                statusFilter === 'flagged'
                  ? 'bg-[#ba1a1a] text-white'
                  : 'bg-[#ffdad6] text-[#93000a] hover:bg-[#ffb4ab]'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">warning</span>
              Riesgo
            </button>
          </div>

          {/* Location Specific Filter */}
          <div className="md:col-span-3">
            <div className="relative">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-lg px-3 py-1.5 text-[12px] text-[#071e27] font-semibold appearance-none focus:outline-none focus:border-[#004d99]"
              >
                <option value="all">Todas las ubicaciones</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    📍 {loc}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#727783] text-[16px] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Search Box */}
          <div className="md:col-span-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#727783] text-[16px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en el historial..."
                className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-[#071e27] placeholder-[#727783] focus:border-[#004d99] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#727783] hover:text-[#071e27]"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredPhotos.length === 0 && (
        <div className="bg-white rounded-xl border border-[#c2c6d4] p-12 text-center my-6">
          <span className="material-symbols-outlined text-5xl text-[#727783] mb-3">
            history
          </span>
          <h3 className="font-['Hanken_Grotesk'] font-bold text-lg text-[#071e27]">
            No se encontraron fotos en el historial
          </h3>
          <p className="text-[14px] text-[#424752] mt-1 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' || selectedLocation !== 'all'
              ? 'No hay registros que coincidan con los filtros aplicados. Intenta restablecer los filtros de búsqueda.'
              : 'Aún no se han registrado fotos de inspección en el historial del terminal.'}
          </p>
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="mt-4 bg-[#004d99] text-white px-4 py-2 rounded-lg font-bold text-[13px] inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
            Subir Primera Foto
          </button>
        </div>
      )}

      {/* Grouped Content Render */}
      <div className="space-y-8">
        {groupedData.map((group) => (
          <div key={group.key} className="space-y-3">
            {/* Group Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#e6f6ff] px-4 py-2.5 rounded-xl border border-[#c2c6d4]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004d99] text-[20px]">
                  {groupBy === 'date' ? 'event' : groupBy === 'location' ? 'location_city' : 'flag'}
                </span>
                <h2 className="font-['Hanken_Grotesk'] font-bold text-base sm:text-lg text-[#071e27]">
                  {group.title}
                </h2>
                <span className="bg-[#004d99] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {group.count} {group.count === 1 ? 'inspección' : 'inspecciones'}
                </span>
              </div>

              {/* Group stats indicators */}
              <div className="flex items-center gap-2 text-[12px] font-semibold">
                <span className="inline-flex items-center gap-1 bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span>
                  {group.completedCount} Terminados
                </span>
                <span className="inline-flex items-center gap-1 bg-[#fef3c7] text-[#92400e] px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
                  {group.inProgressCount} En proceso
                </span>
              </div>
            </div>

            {/* View Mode: Cards with Full Properties */}
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.items.map((photo) => {
                  const execStatus = photo.executionStatus || 'En proceso';
                  const isCompleted = execStatus === 'Terminado';

                  return (
                    <div
                      key={photo.id}
                      onClick={() => onSelectPhoto(photo)}
                      className="bg-white rounded-xl border border-[#c2c6d4] hover:border-[#004d99] hover:shadow-md transition-all p-4 cursor-pointer flex flex-col justify-between gap-3 group relative"
                    >
                      {/* Top Row: Thumbnail + Core Metadata */}
                      <div className="flex gap-4">
                        {/* Thumbnail Image */}
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-[#cfe6f2] flex-shrink-0 border border-[#c2c6d4] relative">
                          <img
                            src={photo.imageUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-mono px-1 py-0.5 rounded">
                            {photo.displayId}
                          </span>
                        </div>

                        {/* Core Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-['Hanken_Grotesk'] font-bold text-[15px] sm:text-base text-[#071e27] truncate leading-tight">
                                {photo.name}
                              </h3>

                              {/* Quick status toggle button */}
                              <button
                                type="button"
                                onClick={(e) => handleToggleExecutionStatus(photo, e)}
                                className={`px-2 py-0.5 rounded-full font-['Inter'] font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer flex-shrink-0 ${
                                  isCompleted
                                    ? 'bg-[#a0f399] text-[#217128] hover:bg-[#85e67d]'
                                    : 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]'
                                }`}
                                title="Haz clic para alternar estado"
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  {isCompleted ? 'check_circle' : 'pending_actions'}
                                </span>
                                {execStatus}
                              </button>
                            </div>

                            {/* Location & Camera Properties */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#424752] mt-1">
                              <div className="flex items-center gap-1 font-semibold text-[#071e27] truncate">
                                <span className="material-symbols-outlined text-[14px] text-[#004d99] flex-shrink-0">
                                  location_on
                                </span>
                                <span className="truncate">{photo.location}</span>
                              </div>

                              {/* Camera code badge */}
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#004d99]/10 text-[#004d99] font-bold text-[10px] border border-[#004d99]/20">
                                <span className="material-symbols-outlined text-[12px]">videocam</span>
                                {photo.cameraCode || 'SB850'}
                              </span>

                              {/* Camera type badge */}
                              {photo.cameraType && (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                  photo.cameraType === 'MT'
                                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                    : photo.cameraType === 'BT'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-purple-100 text-purple-800 border border-purple-200'
                                }`}>
                                  <span className="material-symbols-outlined text-[11px]">
                                    {photo.cameraType === 'MT' ? 'bolt' : photo.cameraType === 'BT' ? 'electric_bolt' : 'lan'}
                                  </span>
                                  {photo.cameraType}
                                </span>
                              )}

                              {/* Tramo badge */}
                              {photo.tramo && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#004d99] text-white font-bold text-[10px] shadow-2xs">
                                  <span className="material-symbols-outlined text-[11px]">plumbing</span>
                                  {photo.tramo}
                                </span>
                              )}

                              {/* Metraje badge */}
                              {photo.metraje && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1b6d24] text-white font-bold text-[10px] shadow-2xs">
                                  <span className="material-symbols-outlined text-[11px]">straighten</span>
                                  {photo.metraje}m
                                </span>
                              )}
                            </div>

                            {/* Date Property */}
                            <div className="flex items-center gap-1 text-[12px] text-[#727783] mt-0.5">
                              <span className="material-symbols-outlined text-[14px] flex-shrink-0">
                                schedule
                              </span>
                              <span>{photo.date}</span>
                            </div>
                          </div>

                          {/* Category & Inspector */}
                          <div className="flex items-center justify-between text-[11px] text-[#424752] mt-2 pt-2 border-t border-[#f0f4f8]">
                            <span className="bg-[#e6f6ff] text-[#004d99] font-semibold px-2 py-0.5 rounded">
                              {photo.type || photo.categoryLabel}
                            </span>
                            <div className="flex items-center gap-1 text-[#727783]">
                              <img
                                src={photo.inspectorAvatar}
                                alt={photo.inspectorName}
                                className="w-4 h-4 rounded-full border border-[#c2c6d4]"
                              />
                              <span className="truncate max-w-[120px]">{photo.inspectorName}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Field Notes Snippet Property */}
                      {photo.fieldNotes && (
                        <div className="bg-[#f3faff] p-2.5 rounded-lg border border-[#e2e8f0] text-[12px] text-[#424752] line-clamp-2">
                          <strong className="text-[#071e27]">Notas:</strong> {photo.fieldNotes}
                        </div>
                      )}

                      {/* Bottom Properties Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#dbf1fe] text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded font-medium ${
                            photo.status === 'Synced'
                              ? 'bg-[#cfe6f2] text-[#004d99]'
                              : photo.status === 'Flagged'
                              ? 'bg-[#ffdad6] text-[#93000a]'
                              : 'bg-[#f0f2f5] text-[#727783]'
                          }`}>
                            {photo.status === 'Synced' ? 'Sincronizado' : photo.status === 'Flagged' ? 'Alerta Riesgo' : 'En cola'}
                          </span>
                          {photo.verified && (
                            <span className="bg-[#dcfce7] text-[#166534] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">verified</span>
                              Verificado
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectPhoto(photo)}
                            className="px-2 py-1 bg-[#e6f6ff] text-[#004d99] hover:bg-[#cfe6f2] rounded font-bold text-[11px] flex items-center gap-0.5 transition-colors"
                          >
                            <span>Ver Propiedades</span>
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoToDelete(photo)}
                            className="p-1 text-[#727783] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded transition-colors"
                            title="Eliminar inspección"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* View Mode: Comprehensive Table of Properties */
              <div className="bg-white rounded-xl border border-[#c2c6d4] overflow-x-auto shadow-xs">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f3faff] border-b border-[#c2c6d4] text-[#424752] font-['Inter'] font-bold text-[12px] uppercase tracking-wider">
                      <th className="p-3">Foto / ID</th>
                      <th className="p-3">Nombre Inspección</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Ubicación</th>
                      <th className="p-3">Cámara / Red</th>
                      <th className="p-3">Tramo / Metraje</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Inspector</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6f6ff]">
                    {group.items.map((photo) => {
                      const execStatus = photo.executionStatus || 'En proceso';
                      const isCompleted = execStatus === 'Terminado';

                      return (
                        <tr
                          key={photo.id}
                          onClick={() => onSelectPhoto(photo)}
                          className="hover:bg-[#f3faff] transition-colors cursor-pointer"
                        >
                          {/* Photo + Display ID */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <img
                                src={photo.imageUrl}
                                alt={photo.name}
                                className="w-10 h-10 rounded object-cover border border-[#c2c6d4] flex-shrink-0"
                              />
                              <span className="font-mono text-[11px] font-bold text-[#004d99]">
                                {photo.displayId}
                              </span>
                            </div>
                          </td>

                          {/* Photo Name */}
                          <td className="p-3 font-bold text-[#071e27]">
                            <div className="max-w-[200px] truncate">{photo.name}</div>
                          </td>

                          {/* Execution Status Button */}
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleToggleExecutionStatus(photo, e)}
                              className={`px-2 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 transition-all ${
                                isCompleted
                                  ? 'bg-[#a0f399] text-[#217128] hover:bg-[#85e67d]'
                                  : 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]'
                              }`}
                              title="Haz clic para cambiar estado"
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {isCompleted ? 'check_circle' : 'pending_actions'}
                              </span>
                              {execStatus}
                            </button>
                          </td>

                          {/* Location */}
                          <td className="p-3 text-[#424752]">
                            <div className="flex items-center gap-1 truncate max-w-[160px]">
                              <span className="material-symbols-outlined text-[14px] text-[#004d99]">
                                location_on
                              </span>
                              <span className="truncate">{photo.location}</span>
                            </div>
                          </td>

                          {/* Camera Model & System Type */}
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#004d99]/10 text-[#004d99] font-bold text-[11px]">
                                {photo.cameraCode || 'SB850'}
                              </span>
                              {photo.cameraType && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[10px] ${
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
                          </td>

                          {/* Tramo & Metraje */}
                          <td className="p-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {photo.tramo ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#004d99] text-white font-['Hanken_Grotesk'] font-bold text-[11px] shadow-2xs whitespace-nowrap">
                                  <span className="material-symbols-outlined text-[12px]">plumbing</span>
                                  {photo.tramo}
                                </span>
                              ) : null}

                              {photo.metraje ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b6d24] text-white font-['Hanken_Grotesk'] font-bold text-[11px] shadow-2xs whitespace-nowrap">
                                  <span className="material-symbols-outlined text-[12px]">straighten</span>
                                  {photo.metraje}m
                                </span>
                              ) : null}

                              {!photo.tramo && !photo.metraje && (
                                <span className="text-[#727783] text-[11px] italic">-</span>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="p-3 text-[#727783] whitespace-nowrap">
                            {photo.date}
                          </td>

                          {/* Inspector */}
                          <td className="p-3 text-[#424752]">
                            <div className="flex items-center gap-1.5">
                              <img
                                src={photo.inspectorAvatar}
                                alt={photo.inspectorName}
                                className="w-5 h-5 rounded-full border border-[#c2c6d4]"
                              />
                              <span className="truncate max-w-[110px] text-[12px]">
                                {photo.inspectorName}
                              </span>
                            </div>
                          </td>

                          {/* Category Type */}
                          <td className="p-3 text-[#004d99] font-medium text-[12px]">
                            {photo.type || photo.categoryLabel}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onSelectPhoto(photo)}
                                className="p-1.5 text-[#004d99] hover:bg-[#cfe6f2] rounded"
                                title="Ver detalles y propiedades"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPhotoToDelete(photo)}
                                className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] rounded"
                                title="Eliminar"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                ¿Eliminar Foto del Historial?
              </h3>
            </div>
            <p className="text-[14px] text-[#424752] mb-4">
              ¿Estás seguro de que deseas eliminar permanentemente <strong>{photoToDelete.name}</strong> ({photoToDelete.displayId})?
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
    </div>
  );
};
