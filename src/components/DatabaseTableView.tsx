import React, { useState, useMemo } from 'react';
import { InspectionPhoto, InspectorProfile, CameraType, ExecutionStatus, getElementType } from '../types';
import { StatusBreakdown, getWorkElementStatistics } from '../lib/workElementStatistics';
import { getActaItemKey } from '../data/actaItems';

interface DatabaseTableViewProps {
  photos: InspectionPhoto[];
  inspector: InspectorProfile;
  onSelectPhoto: (photo: InspectionPhoto) => void;
  onNavigateToMap: (photo?: InspectionPhoto) => void;
  onNavigateToUpload: () => void;
  onEditPhoto: (photo: InspectionPhoto) => void;
  onDeletePhoto: (id: string) => void;
  onUpdatePhoto: (updated: InspectionPhoto) => void;
}

type SortField = 'cameraCode' | 'cameraType' | 'name' | 'tramo' | 'metraje' | 'executionStatus' | 'date' | 'inspectorName';
type SortOrder = 'asc' | 'desc';

const getPhotoActaItems = (photo: InspectionPhoto) => photo.actaItems?.length
  ? photo.actaItems
  : photo.actaItem ? [photo.actaItem] : [];

const StatusMatrixCard: React.FC<{
  title: string;
  icon: string;
  accentClass: string;
  data: Record<'MT' | 'BT' | 'Datos', StatusBreakdown>;
  total: number;
  note?: string;
}> = ({ title, icon, accentClass, data, total, note }) => (
  <section className="overflow-hidden rounded-2xl border border-[#c2c6d4] bg-white shadow-xs" aria-label={title}>
    <div className="flex items-center justify-between border-b border-[#dbe5e9] bg-[#f7fbfd] px-4 py-3">
      <div>
        <h2 className="font-['Hanken_Grotesk'] text-sm font-bold text-[#071e27]">{title}</h2>
        <p className="mt-0.5 text-[11px] text-[#607d8b]">Estado de ejecución por clasificación técnica</p>
      </div>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-left text-xs">
        <thead className="bg-white text-[10px] uppercase tracking-wide text-[#607d8b]">
          <tr>
            <th className="px-4 py-2.5 font-bold">Tipo</th>
            <th className="px-3 py-2.5 text-center font-bold">No iniciado</th>
            <th className="px-3 py-2.5 text-center font-bold">En proceso</th>
            <th className="px-3 py-2.5 text-center font-bold">Terminado</th>
            <th className="px-4 py-2.5 text-right font-bold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e5edf1] text-[#173f58]">
          {(['MT', 'BT', 'Datos'] as const).map((type) => (
            <tr key={type}>
              <td className="px-4 py-2.5 font-bold">{type}</td>
              <td className="px-3 py-2.5 text-center text-slate-600">{data[type]['No iniciado']}</td>
              <td className="px-3 py-2.5 text-center text-amber-700">{data[type]['En proceso']}</td>
              <td className="px-3 py-2.5 text-center text-emerald-700">{data[type].Terminado}</td>
              <td className="px-4 py-2.5 text-right font-bold">{data[type].total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="border-t border-[#e5edf1] px-4 py-2.5 text-[11px] text-[#607d8b]">
      <span className="font-bold text-[#173f58]">{total} elementos físicos.</span>{note ? ` ${note}` : ''}
    </div>
  </section>
);

export const DatabaseTableView: React.FC<DatabaseTableViewProps> = ({
  photos,
  inspector,
  onSelectPhoto,
  onNavigateToMap,
  onNavigateToUpload,
  onEditPhoto,
  onDeletePhoto,
  onUpdatePhoto,
}) => {
  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCameraCode, setFilterCameraCode] = useState<string>('all');
  const [filterTramo, setFilterTramo] = useState<string>('all');
  const [filterSync, setFilterSync] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Image Zoom Modal Preview
  const [previewPhoto, setPreviewPhoto] = useState<InspectionPhoto | null>(null);

  // Extract unique filter options
  const uniqueCameraCodes = useMemo(() => {
    const codes = new Set<string>();
    photos.forEach((p) => {
      if (p.cameraCode) codes.add(p.cameraCode);
    });
    return Array.from(codes).sort();
  }, [photos]);

  const uniqueTramos = useMemo(() => {
    const tramos = new Set<string>();
    photos.forEach((p) => {
      if (getElementType(p) === 'tuberia' && p.tramo) tramos.add(p.tramo);
    });
    return Array.from(tramos).sort();
  }, [photos]);

  // Filtered & Sorted Photos
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // Type Filter (MT / BT / Datos)
      if (filterType !== 'all') {
        if ((photo.cameraType || '').toUpperCase() !== filterType.toUpperCase()) {
          return false;
        }
      }

      // Execution Status Filter
      if (filterStatus !== 'all') {
        if (photo.executionStatus !== filterStatus) {
          return false;
        }
      }

      // Camera Code Filter
      if (filterCameraCode !== 'all') {
        if (photo.cameraCode !== filterCameraCode) {
          return false;
        }
      }

      // Tramo Filter
      if (filterTramo !== 'all') {
        if (photo.tramo !== filterTramo) {
          return false;
        }
      }

      // Sync Status Filter
      if (filterSync !== 'all') {
        if (photo.status !== filterSync) {
          return false;
        }
      }

      // Search Term across all fields
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchCode = (photo.cameraCode || '').toLowerCase().includes(query);
        const matchName = photo.name.toLowerCase().includes(query);
        const matchLoc = photo.location.toLowerCase().includes(query);
        const matchTramo = (photo.tramo || '').toLowerCase().includes(query);
        const matchNotes = (photo.fieldNotes || '').toLowerCase().includes(query);
        const matchInspector = photo.inspectorName.toLowerCase().includes(query);
        const matchType = (photo.cameraType || '').toLowerCase().includes(query);
        const matchMetraje = String(photo.metraje || '').toLowerCase().includes(query);
        const matchCategory = (photo.categoryLabel || '').toLowerCase().includes(query);
        const matchActaItem = getPhotoActaItems(photo)
          .flatMap((item) => [item.code, item.description, item.section])
          .some((value) => String(value).toLowerCase().includes(query));

        if (
          !matchCode &&
          !matchName &&
          !matchLoc &&
          !matchTramo &&
          !matchNotes &&
          !matchInspector &&
          !matchType &&
          !matchMetraje &&
          !matchCategory &&
          !matchActaItem
        ) {
          return false;
        }
      }

      return true;
    });
  }, [photos, filterType, filterStatus, filterCameraCode, filterTramo, filterSync, searchTerm]);

  // Sorted list
  const sortedPhotos = useMemo(() => {
    return [...filteredPhotos].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'metraje') {
        aVal = typeof a.metraje === 'number' ? a.metraje : parseFloat(String(a.metraje || '0')) || 0;
        bVal = typeof b.metraje === 'number' ? b.metraje : parseFloat(String(b.metraje || '0')) || 0;
      } else if (sortField === 'date') {
        aVal = new Date(a.dateRaw || a.date).getTime() || 0;
        bVal = new Date(b.dateRaw || b.date).getTime() || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredPhotos, sortField, sortOrder]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const cameras = photos.filter((p) => getElementType(p) === 'camara');
    const pipes = photos.filter((p) => getElementType(p) === 'tuberia');
    const total = cameras.length;
    const mtCount = cameras.filter((p) => (p.cameraType || '').toUpperCase() === 'MT').length;
    const btCount = cameras.filter((p) => (p.cameraType || '').toUpperCase() === 'BT').length;
    const datosCount = cameras.filter((p) => (p.cameraType || '').toUpperCase() === 'DATOS').length;
    const terminadosCount = cameras.filter((p) => p.executionStatus === 'Terminado').length;
    const enProcesoCount = cameras.filter((p) => p.executionStatus === 'En proceso').length;
    const noIniciadosCount = cameras.filter((p) => p.executionStatus === 'No iniciado').length;

    const totalMetros = pipes.reduce((acc, curr) => {
      const m = typeof curr.metraje === 'number' ? curr.metraje : parseFloat(String(curr.metraje || '0'));
      return acc + (isNaN(m) ? 0 : m);
    }, 0);

    const positionedOnPlanCount = photos.filter((p) => typeof p.planX === 'number' && typeof p.planY === 'number').length;
    const percentTerminado = total > 0 ? Math.round((terminadosCount / total) * 100) : 0;

    return {
      total,
      mtCount,
      btCount,
      datosCount,
      terminadosCount,
      enProcesoCount,
      noIniciadosCount,
      totalMetros: Math.round(totalMetros * 10) / 10,
      positionedOnPlanCount,
      percentTerminado,
    };
  }, [photos]);

  const workElementStatistics = useMemo(() => getWorkElementStatistics(photos), [photos]);

  // Handle Sort Click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.length === sortedPhotos.length && sortedPhotos.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedPhotos.map((p) => p.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Batch Status Update
  const handleBatchStatusUpdate = (status: ExecutionStatus) => {
    selectedIds.forEach((id) => {
      const photo = photos.find((p) => p.id === id);
      if (photo) {
        onUpdatePhoto({ ...photo, executionStatus: status });
      }
    });
    setSelectedIds([]);
  };

  // Batch Delete
  const handleBatchDelete = () => {
    if (window.confirm(`¿Estás seguro de eliminar los ${selectedIds.length} elementos seleccionados?`)) {
      selectedIds.forEach((id) => {
        onDeletePhoto(id);
      });
      setSelectedIds([]);
    }
  };

  // Export to CSV
  const handleExportCSV = (exportSelectedOnly = false) => {
    const listToExport = exportSelectedOnly
      ? sortedPhotos.filter((p) => selectedIds.includes(p.id))
      : sortedPhotos;

    if (listToExport.length === 0) {
      alert('No hay elementos para exportar.');
      return;
    }

    const headers = [
      'ID',
      'Código Cámara',
      'Tipo de Red',
      'Nombre Elemento',
      'Ítems de Acta - Códigos',
      'Ítems de Acta - Descripciones',
      'Ítems de Acta - Unidades',
      'Ítems de Acta - Cantidades Contractuales',
      'Tramo',
      'Metraje (m)',
      'Latitud',
      'Longitud',
      'Latitud Fin',
      'Longitud Fin',
      'Estado de Ejecución',
      'Estado de Sincronización',
      'Ubicación / Área',
      'Inspector',
      'Fecha Inspección',
      'Notas de Campo',
      'Peligro / Acción Inmediata',
    ];

    const rows = listToExport.map((p) => [
      `"${p.displayId || p.id}"`,
      `"${p.cameraCode || 'N/A'}"`,
      `"${p.cameraType || 'MT'}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${getPhotoActaItems(p).map((item) => item.code).join(' | ').replace(/"/g, '""')}"`,
      `"${getPhotoActaItems(p).map((item) => item.description).join(' | ').replace(/"/g, '""')}"`,
      `"${getPhotoActaItems(p).map((item) => item.unit || '—').join(' | ').replace(/"/g, '""')}"`,
      `"${getPhotoActaItems(p).map((item) => item.quantity || '—').join(' | ').replace(/"/g, '""')}"`,
      `"${(p.tramo || '').replace(/"/g, '""')}"`,
      `"${p.metraje || '0'}"`,
      `"${p.latitude || ''}"`,
      `"${p.longitude || ''}"`,
      `"${p.endLatitude || ''}"`,
      `"${p.endLongitude || ''}"`,
      `"${p.executionStatus || 'En proceso'}"`,
      `"${p.status || 'Synced'}"`,
      `"${(p.location || '').replace(/"/g, '""')}"`,
      `"${(p.inspectorName || '').replace(/"/g, '""')}"`,
      `"${p.date || ''}"`,
      `"${(p.fieldNotes || '').replace(/"/g, '""')}"`,
      `"${p.requiresImmediateAction ? 'SÍ' : 'NO'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `BaseDatos_Camaras_Tramos_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(sortedPhotos, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `BaseDatos_Plano_Obra_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Table
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ----------------- HEADER & ACTIONS ----------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#c2c6d4] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#e6f6ff] text-[#004d99] flex items-center justify-center border border-[#cfe6f2]">
              <span className="material-symbols-outlined text-[24px]">database</span>
            </div>
            <div>
              <h1 className="font-['Hanken_Grotesk'] font-bold text-xl sm:text-2xl text-[#071e27]">
                Base de Datos de Obra
              </h1>
              <p className="text-xs sm:text-sm text-[#424752] font-['Inter']">
                Inventario técnico tabulado de cámaras, tramos de canalización, metrajes y elementos del plano
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add New Camera */}
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="px-4 py-2.5 bg-[#004d99] hover:bg-[#1565c0] text-white font-['Inter'] font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Nueva Cámara / Foto</span>
          </button>

          {/* View in Map */}
          <button
            type="button"
            onClick={() => onNavigateToMap()}
            className="px-3.5 py-2.5 bg-[#cfe6f2] hover:bg-[#b8d8ec] text-[#004d99] font-['Inter'] font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            <span>Ver en Plano</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={() => handleExportCSV(false)}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-[#071e27] border border-[#c2c6d4] font-['Inter'] font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            title="Exportar archivo CSV para Excel"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-600">table_chart</span>
            <span>Exportar CSV</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJSON}
            className="p-2.5 bg-white hover:bg-slate-50 text-[#424752] border border-[#c2c6d4] rounded-xl transition-all shadow-xs"
            title="Descargar copia técnica en JSON"
          >
            <span className="material-symbols-outlined text-[20px]">data_object</span>
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 bg-white hover:bg-slate-50 text-[#424752] border border-[#c2c6d4] rounded-xl transition-all shadow-xs"
            title="Imprimir tabla o guardar como PDF"
          >
            <span className="material-symbols-outlined text-[20px]">print</span>
          </button>
        </div>
      </div>

      {/* ----------------- KPI SUMMARY CARDS ----------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Elements */}
        <div className="bg-white p-4 rounded-2xl border border-[#c2c6d4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-['Inter'] font-bold text-[#727783] uppercase tracking-wider">
              Total Cámaras
            </span>
            <span className="w-7 h-7 rounded-lg bg-[#e6f6ff] text-[#004d99] flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">inbox</span>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-['Hanken_Grotesk'] text-[#071e27]">
            {metrics.total}
          </div>
          <div className="mt-1 text-[11px] text-[#424752] flex items-center gap-1.5">
            <span className="text-[#004d99] font-bold">{metrics.mtCount} MT</span>
            <span>•</span>
            <span className="text-amber-600 font-bold">{metrics.btCount} BT</span>
            <span>•</span>
            <span className="text-teal-600 font-bold">{metrics.datosCount} Datos</span>
          </div>
          <div className="mt-1 text-[10px] text-[#607d8b]">
            {metrics.noIniciadosCount} sin iniciar · {metrics.enProcesoCount} en proceso
          </div>
        </div>

        {/* Metraje Total */}
        <div className="bg-white p-4 rounded-2xl border border-[#c2c6d4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-['Inter'] font-bold text-[#727783] uppercase tracking-wider">
              Metraje de Tubería
            </span>
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">straighten</span>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-['Hanken_Grotesk'] text-[#071e27]">
            {metrics.totalMetros} <span className="text-sm font-normal text-[#727783]">m</span>
          </div>
          <div className="mt-1 text-[11px] text-[#424752]">
            En {uniqueTramos.length} tramos canalizados
          </div>
        </div>

        {/* Tubos por red */}
        <div className="bg-white p-4 rounded-2xl border border-[#c2c6d4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-['Inter'] font-bold text-[#727783] uppercase tracking-wider">
              Tubos por red
            </span>
            <span className="w-7 h-7 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">account_tree</span>
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-[#eef6ff] px-1.5 py-1.5">
              <div className="text-lg font-bold font-['Hanken_Grotesk'] text-[#075a91]">{workElementStatistics.tubeTotals.MT}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-[#547181]">MT</div>
            </div>
            <div className="rounded-lg bg-amber-50 px-1.5 py-1.5">
              <div className="text-lg font-bold font-['Hanken_Grotesk'] text-amber-700">{workElementStatistics.tubeTotals.BT}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-amber-800">BT</div>
            </div>
            <div className="rounded-lg bg-teal-50 px-1.5 py-1.5">
              <div className="text-lg font-bold font-['Hanken_Grotesk'] text-teal-700">{workElementStatistics.tubeTotals.Datos}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-teal-800">Datos</div>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-[#607d8b]">Cantidad física de tubos registrados</div>
        </div>

        {/* Avance de Obra */}
        <div className="bg-white p-4 rounded-2xl border border-[#c2c6d4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-['Inter'] font-bold text-[#727783] uppercase tracking-wider">
              Avance Ejecución
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-['Hanken_Grotesk'] text-emerald-700">
              {metrics.percentTerminado}%
            </span>
            <span className="text-xs text-[#727783]">
              ({metrics.terminadosCount}/{metrics.total})
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics.percentTerminado}%` }}
            />
          </div>
        </div>

        {/* Tramos Únicos */}
        <div className="bg-white p-4 rounded-2xl border border-[#c2c6d4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-['Inter'] font-bold text-[#727783] uppercase tracking-wider">
              Tramos de Red
            </span>
            <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">alt_route</span>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-['Hanken_Grotesk'] text-[#071e27]">
            {uniqueTramos.length}
          </div>
          <div className="mt-1 text-[11px] text-[#424752] truncate">
            {uniqueTramos.slice(0, 2).join(', ')}
            {uniqueTramos.length > 2 && ` +${uniqueTramos.length - 2}`}
          </div>
        </div>

        {/* Ubicadas en plano */}
        <div className="bg-white p-4 rounded-2xl border border-[#c2c6d4] shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-['Inter'] font-bold text-[#727783] uppercase tracking-wider">
              Ubicadas en plano
            </span>
            <span className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">location_on</span>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-['Hanken_Grotesk'] text-[#071e27]">
            {metrics.positionedOnPlanCount}
          </div>
          <div className="mt-1 text-[11px] text-cyan-700 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
            Marcadas sobre el JPG
          </div>
        </div>
      </div>

      <div className="grid gap-3.5 xl:grid-cols-2">
        <StatusMatrixCard
          title="Cámaras por estado"
          icon="videocam"
          accentClass="bg-[#e6f6ff] text-[#004d99]"
          data={workElementStatistics.cameras}
          total={workElementStatistics.totalCameras}
        />
        <StatusMatrixCard
          title="Tramos de tubería por estado"
          icon="timeline"
          accentClass="bg-indigo-50 text-indigo-700"
          data={workElementStatistics.pipes}
          total={workElementStatistics.totalPipes}
          note="Un tramo con varias conducciones se cuenta en cada tipo asociado."
        />
      </div>

      {/* ----------------- SEARCH & FILTERS TOOLBAR ----------------- */}
      <div className="bg-white p-4 rounded-2xl border border-[#c2c6d4] shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Universal Search Box */}
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727783] text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código de cámara, tramo, elemento, inspector o notas..."
              className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[#f3faff] border border-[#c2c6d4] rounded-xl outline-none focus:border-[#004d99] focus:ring-2 focus:ring-[#004d99]/20 transition-all font-['Inter'] text-[#071e27] placeholder-[#727783]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#727783] hover:text-[#071e27]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Quick Filter Selects */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter: Tipo de Red */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 text-xs font-['Inter'] font-semibold bg-[#f3faff] border border-[#c2c6d4] rounded-xl outline-none focus:border-[#004d99] text-[#071e27]"
            >
              <option value="all">Red: Todas</option>
              <option value="MT">Media Tensión (MT)</option>
              <option value="BT">Baja Tensión (BT)</option>
              <option value="DATOS">Datos / Control</option>
            </select>

            {/* Filter: Estado de Ejecución */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 text-xs font-['Inter'] font-semibold bg-[#f3faff] border border-[#c2c6d4] rounded-xl outline-none focus:border-[#004d99] text-[#071e27]"
            >
              <option value="all">Estado: Todos</option>
              <option value="Terminado">Terminado</option>
              <option value="En proceso">En proceso</option>
            </select>

            {/* Filter: Código de Cámara */}
            {uniqueCameraCodes.length > 0 && (
              <select
                value={filterCameraCode}
                onChange={(e) => setFilterCameraCode(e.target.value)}
                className="px-3 py-2.5 text-xs font-['Inter'] font-semibold bg-[#f3faff] border border-[#c2c6d4] rounded-xl outline-none focus:border-[#004d99] text-[#071e27]"
              >
                <option value="all">Cámara: Todas</option>
                {uniqueCameraCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            )}

            {/* Filter: Tramo */}
            {uniqueTramos.length > 0 && (
              <select
                value={filterTramo}
                onChange={(e) => setFilterTramo(e.target.value)}
                className="px-3 py-2.5 text-xs font-['Inter'] font-semibold bg-[#f3faff] border border-[#c2c6d4] rounded-xl outline-none focus:border-[#004d99] text-[#071e27]"
              >
                <option value="all">Tramo: Todos</option>
                {uniqueTramos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {/* Reset Filters */}
            {(searchTerm || filterType !== 'all' || filterStatus !== 'all' || filterCameraCode !== 'all' || filterTramo !== 'all' || filterSync !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('all');
                  setFilterStatus('all');
                  setFilterCameraCode('all');
                  setFilterTramo('all');
                  setFilterSync('all');
                }}
                className="px-3 py-2 text-xs font-['Inter'] font-bold text-[#ba1a1a] hover:bg-[#ffdad6] rounded-xl transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Selection Batch Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-[#e6f6ff] border border-[#004d99]/30 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-['Inter'] font-bold text-[#004d99]">
              <span className="w-5 h-5 rounded-full bg-[#004d99] text-white flex items-center justify-center text-[10px]">
                {selectedIds.length}
              </span>
              <span>elementos seleccionados</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBatchStatusUpdate('Terminado')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-['Inter'] font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>Marcar Terminado</span>
              </button>

              <button
                type="button"
                onClick={() => handleBatchStatusUpdate('En proceso')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-['Inter'] font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-[15px]">pending</span>
                <span>Marcar En proceso</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportCSV(true)}
                className="px-3 py-1.5 bg-white text-[#071e27] border border-[#c2c6d4] font-['Inter'] font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-[15px] text-emerald-600">download</span>
                <span>Exportar Seleccionados</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-3 py-1.5 bg-[#ffdad6] hover:bg-[#ffb4ab] text-[#ba1a1a] font-['Inter'] font-bold text-xs rounded-lg transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ----------------- TABULATED DATA TABLE ----------------- */}
      <div className="bg-white rounded-2xl border border-[#c2c6d4] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-['Inter'] text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#f3faff] border-b border-[#c2c6d4] text-[#424752] font-semibold select-none">
                {/* Checkbox Select All */}
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === sortedPhotos.length && sortedPhotos.length > 0}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-[#c2c6d4] text-[#004d99] focus:ring-[#004d99] cursor-pointer"
                  />
                </th>

                {/* Photo Thumbnail */}
                <th className="py-3.5 px-3 w-16 text-center">Foto</th>

                {/* Camera Code */}
                <th
                  onClick={() => handleSort('cameraCode')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#004d99] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Cámara</span>
                    {sortField === 'cameraCode' && (
                      <span className="material-symbols-outlined text-[16px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Network Type */}
                <th
                  onClick={() => handleSort('cameraType')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#004d99] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Red</span>
                    {sortField === 'cameraType' && (
                      <span className="material-symbols-outlined text-[16px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Element / Name */}
                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#004d99] transition-colors min-w-[180px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Elemento / Descripción</span>
                    {sortField === 'name' && (
                      <span className="material-symbols-outlined text-[16px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Ítem de acta */}
                <th className="min-w-[250px] px-3 py-3.5">Ítem de acta</th>

                {/* Tramo */}
                <th
                  onClick={() => handleSort('tramo')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#004d99] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Tramo</span>
                    {sortField === 'tramo' && (
                      <span className="material-symbols-outlined text-[16px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Metraje */}
                <th
                  onClick={() => handleSort('metraje')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#004d99] transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Metraje</span>
                    {sortField === 'metraje' && (
                      <span className="material-symbols-outlined text-[16px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Ubicación manual en plano */}
                <th className="py-3.5 px-3">Ubicación en plano</th>

                {/* Estado de Ejecución */}
                <th
                  onClick={() => handleSort('executionStatus')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#004d99] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Estado</span>
                    {sortField === 'executionStatus' && (
                      <span className="material-symbols-outlined text-[16px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Inspector */}
                <th
                  onClick={() => handleSort('inspectorName')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#004d99] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Inspector</span>
                    {sortField === 'inspectorName' && (
                      <span className="material-symbols-outlined text-[16px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Date */}
                <th
                  onClick={() => handleSort('date')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#004d99] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Fecha</span>
                    {sortField === 'date' && (
                      <span className="material-symbols-outlined text-[16px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#c2c6d4]/60">
              {sortedPhotos.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[#727783]">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <span className="material-symbols-outlined text-[28px]">search_off</span>
                    </div>
                    <div className="font-bold text-sm text-[#071e27]">
                      No se encontraron registros con los filtros seleccionados
                    </div>
                    <div className="text-xs mt-1">
                      Intenta buscar con otros términos o limpiar los filtros.
                    </div>
                  </td>
                </tr>
              ) : (
                sortedPhotos.map((photo) => {
                  const isSelected = selectedIds.includes(photo.id);
                  const isMT = (photo.cameraType || '').toUpperCase() === 'MT';
                  const isBT = (photo.cameraType || '').toUpperCase() === 'BT';
                  const isTerminado = photo.executionStatus === 'Terminado';

                  return (
                    <tr
                      key={photo.id}
                      className={`hover:bg-[#f3faff]/70 transition-colors ${
                        isSelected ? 'bg-[#e6f6ff]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(photo.id)}
                          className="w-4 h-4 rounded border-[#c2c6d4] text-[#004d99] focus:ring-[#004d99] cursor-pointer"
                        />
                      </td>

                      {/* Photo Thumbnail Preview */}
                      <td className="py-2.5 px-3 text-center">
                        <div
                          onClick={() => setPreviewPhoto(photo)}
                          className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-[#c2c6d4] cursor-pointer relative group mx-auto shadow-2xs hover:scale-105 transition-transform"
                          title="Haga clic para ampliar la foto"
                        >
                          <img
                            src={photo.imageUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                          </div>
                        </div>
                      </td>

                      {/* Camera Code Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                            isMT
                              ? 'bg-blue-50 text-[#004d99] border-blue-200'
                              : isBT
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-teal-50 text-teal-800 border-teal-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isMT ? 'electrical_services' : 'inbox'}
                          </span>
                          <span>{photo.cameraCode || 'SB850'}</span>
                        </span>
                      </td>

                      {/* Network Type Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            isMT
                              ? 'bg-[#1565c0] text-white'
                              : isBT
                              ? 'bg-amber-600 text-white'
                              : 'bg-teal-700 text-white'
                          }`}
                        >
                          {photo.cameraType || 'MT'}
                        </span>
                      </td>

                      {/* Element Name & Location */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#071e27] text-xs sm:text-sm hover:text-[#004d99] cursor-pointer" onClick={() => onSelectPhoto(photo)}>
                          {photo.name}
                        </div>
                        <div className="text-[11px] text-[#727783] flex items-center gap-1 mt-0.5 truncate max-w-xs">
                          <span className="material-symbols-outlined text-[12px]">location_on</span>
                          <span className="truncate">{photo.location}</span>
                        </div>
                      </td>

                      {/* Ítems de acta */}
                      <td className="px-3 py-3">
                        {getPhotoActaItems(photo).length > 0 ? (
                          <div className="max-w-[280px]">
                            <div className="flex flex-wrap items-center gap-1">
                              {getPhotoActaItems(photo).map((item) => (
                                <span key={getActaItemKey(item)} className="rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#075a91]" title={item.description}>{item.code}</span>
                              ))}
                            </div>
                            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#315c70]" title={getPhotoActaItems(photo).map((item) => item.description).join(' | ')}>
                              {getPhotoActaItems(photo).map((item) => item.description).join(' · ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Tramo */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {photo.tramo ? (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[#071e27] border border-slate-200 text-xs font-medium">
                            {photo.tramo}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Metraje */}
                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono">
                        {photo.metraje !== undefined && photo.metraje !== null && String(photo.metraje) !== '' ? (
                          <span className="font-bold text-xs text-[#071e27] bg-[#f3faff] px-2 py-0.5 rounded border border-[#c2c6d4]">
                            {photo.metraje} m
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Ubicación en plano JPG */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {typeof photo.planX === 'number' && typeof photo.planY === 'number' ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToMap(photo)}
                            className="inline-flex items-center gap-1.5 text-xs text-[#004d99] hover:underline font-mono bg-cyan-50 hover:bg-cyan-100 px-2 py-1 rounded-lg border border-cyan-200 transition-colors"
                            title="Haga clic para ver la posición en el plano"
                          >
                            <span className="material-symbols-outlined text-[14px] text-cyan-700">
                              ads_click
                            </span>
                            <span>
                              {photo.planX.toFixed(0)}%, {photo.planY.toFixed(0)}%
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">location_off</span>
                            Sin ubicar
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isTerminado
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isTerminado ? 'check_circle' : 'pending'}
                          </span>
                          <span>{photo.executionStatus || 'En proceso'}</span>
                        </span>
                      </td>

                      {/* Inspector */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img
                            src={photo.inspectorAvatar || inspector.avatarUrl}
                            alt={photo.inspectorName}
                            className="w-6 h-6 rounded-full object-cover border border-[#c2c6d4]"
                          />
                          <span className="text-xs text-[#071e27] truncate max-w-[100px]">
                            {photo.inspectorName || inspector.name}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-xs text-[#727783]">
                        {photo.date}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Jump to Map */}
                          <button
                            type="button"
                            onClick={() => onNavigateToMap(photo)}
                            className="p-1.5 text-[#004d99] hover:bg-[#cfe6f2] rounded-lg transition-colors"
                            title="Ver en Plano / Mapa"
                          >
                            <span className="material-symbols-outlined text-[18px]">map</span>
                          </button>

                          {/* View Detail */}
                          <button
                            type="button"
                            onClick={() => onSelectPhoto(photo)}
                            className="p-1.5 text-[#424752] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Ver Ficha Completa"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => onEditPhoto(photo)}
                            className="p-1.5 text-[#424752] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar Datos"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar la inspección "${photo.name}"?`)) {
                                onDeletePhoto(photo.id);
                              }
                            }}
                            className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors"
                            title="Eliminar Registro"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 bg-[#f3faff] border-t border-[#c2c6d4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#727783] font-['Inter']">
          <div>
            Mostrando <span className="font-bold text-[#071e27]">{sortedPhotos.length}</span> de{' '}
            <span className="font-bold text-[#071e27]">{photos.length}</span> registros totales en la base de datos
          </div>

          <div className="flex items-center gap-2">
            <span>Metraje filtrado:</span>
            <span className="font-bold text-[#071e27] font-mono bg-white px-2.5 py-1 rounded border border-[#c2c6d4]">
              {sortedPhotos.reduce((acc, curr) => {
                const m = typeof curr.metraje === 'number' ? curr.metraje : parseFloat(String(curr.metraje || '0'));
                return acc + (isNaN(m) ? 0 : m);
              }, 0)}{' '}
              m
            </span>
          </div>
        </div>
      </div>

      {/* ----------------- IMAGE QUICK ZOOM MODAL ----------------- */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[#c2c6d4] flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#e6f6ff] border-b border-[#c2c6d4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#004d99] text-white text-xs font-bold font-mono">
                  {previewPhoto.cameraCode || 'Cámara'}
                </span>
                <h3 className="font-['Hanken_Grotesk'] font-bold text-base text-[#071e27]">
                  {previewPhoto.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#424752] hover:bg-white transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="p-4 bg-slate-900 flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img
                src={previewPhoto.imageUrl}
                alt={previewPhoto.name}
                className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Modal Info Footer */}
            <div className="p-4 bg-white space-y-3 font-['Inter']">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-[#f3faff] rounded-lg border border-[#c2c6d4]">
                  <span className="text-[#727783] block">Tipo de Red:</span>
                  <span className="font-bold text-[#071e27]">{previewPhoto.cameraType || 'MT'}</span>
                </div>
                <div className="p-2 bg-[#f3faff] rounded-lg border border-[#c2c6d4]">
                  <span className="text-[#727783] block">Tramo:</span>
                  <span className="font-bold text-[#071e27]">{previewPhoto.tramo || 'N/A'}</span>
                </div>
                <div className="p-2 bg-[#f3faff] rounded-lg border border-[#c2c6d4]">
                  <span className="text-[#727783] block">Metraje:</span>
                  <span className="font-bold text-[#071e27] font-mono">{previewPhoto.metraje || '0'} m</span>
                </div>
                <div className="p-2 bg-[#f3faff] rounded-lg border border-[#c2c6d4]">
                  <span className="text-[#727783] block">Estado:</span>
                  <span
                    className={`font-bold ${
                      previewPhoto.executionStatus === 'Terminado'
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {previewPhoto.executionStatus || 'En proceso'}
                  </span>
                </div>
              </div>

              {previewPhoto.fieldNotes && (
                <div className="text-xs p-2.5 bg-slate-50 rounded-lg text-[#424752] border border-slate-200">
                  <span className="font-bold text-[#071e27]">Notas de Campo: </span>
                  {previewPhoto.fieldNotes}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#c2c6d4]">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPhoto(null);
                    onNavigateToMap(previewPhoto);
                  }}
                  className="px-4 py-2 bg-[#cfe6f2] hover:bg-[#b8d8ec] text-[#004d99] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">map</span>
                  <span>Ver en Plano</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPhoto(null);
                    onSelectPhoto(previewPhoto);
                  }}
                  className="px-4 py-2 bg-[#004d99] hover:bg-[#1565c0] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Ver Detalle Completo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
