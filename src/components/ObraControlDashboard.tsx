import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  InspectionPhoto,
  InspectorProfile,
  getPhotoProgressPercentage,
  getPhotoRealLinearMeters,
  getTramoMultiplier,
} from '../types';
import { calculateObraMetrics, getSectorLabel } from '../services/obraAnalyticsService';

interface ObraControlDashboardProps {
  photos: InspectionPhoto[];
  inspector?: InspectorProfile;
  onSelectPhoto: (photo: InspectionPhoto) => void;
  onNavigateToMap: (photo?: InspectionPhoto) => void;
  onNavigateToUpload: () => void;
  onOpenSupabaseModal?: () => void;
}

export const ObraControlDashboard: React.FC<ObraControlDashboardProps> = ({
  photos,
  onSelectPhoto,
  onNavigateToMap,
  onNavigateToUpload,
  onOpenSupabaseModal,
}) => {
  // Filtros globales estilo Power BI Slicers
  const [selectedArea, setSelectedArea] = useState<'TODOS' | 'I1' | 'I2' | 'TRONCAL' | 'OTRO'>('TODOS');
  const [selectedActa, setSelectedActa] = useState<string>('TODAS');
  const [soloPendientes, setSoloPendientes] = useState<boolean>(false);
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');
  const [tableFilterType, setTableFilterType] = useState<'TODOS' | 'CAMARA' | 'TUBERIA'>('TODOS');

  // Cálculo de Métricas y Datasets
  const {
    activeSectorMetric,
    globalMetrics,
    filteredItems,
    chartDataBarras,
    chartDataDonut,
    chartActasDonut,
  } = useMemo(() => {
    return calculateObraMetrics(photos, selectedArea, selectedActa, soloPendientes);
  }, [photos, selectedArea, selectedActa, soloPendientes]);

  // Filtrar la tabla de detalle según búsqueda y tipo de elemento
  const displayItems = useMemo(() => {
    return filteredItems.filter((photo) => {
      const isCamara = photo.elementType === 'camara' || (!photo.elementType && Boolean(photo.cameraCode));
      const isTuberia = photo.elementType === 'tuberia' || (!photo.elementType && Boolean(photo.tramo || photo.metraje));

      if (tableFilterType === 'CAMARA' && !isCamara) return false;
      if (tableFilterType === 'TUBERIA' && !isTuberia) return false;

      if (!searchTableQuery) return true;
      const q = searchTableQuery.toLowerCase();
      return (
        photo.name.toLowerCase().includes(q) ||
        (photo.displayId || '').toLowerCase().includes(q) ||
        (photo.cameraType || '').toLowerCase().includes(q) ||
        (photo.tramo || '').toLowerCase().includes(q) ||
        (photo.acta || '').toLowerCase().includes(q) ||
        (photo.executionStatus || '').toLowerCase().includes(q) ||
        (photo.fieldNotes || '').toLowerCase().includes(q)
      );
    });
  }, [filteredItems, searchTableQuery, tableFilterType]);

  // Color dinámico de la barra de progreso
  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-blue-600';
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* 1. Header Ejecutivo & Sincronización */}
      <div className="bg-white border border-[#c2c6d4] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-2 rounded-xl bg-[#004d99]/10 text-[#004d99]">
              <span className="material-symbols-outlined text-[24px]">query_stats</span>
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#071e27] tracking-tight flex items-center gap-2">
                Control de Avance Físico de Obra
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Power BI Style
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#424752] mt-0.5">
                Seguimiento integral de Cámaras (MT/BT/Datos), Tramos de Tubería y Actas de Liquidación.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {onOpenSupabaseModal && (
            <button
              type="button"
              onClick={onOpenSupabaseModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#c2c6d4] bg-[#f8fbff] text-xs font-bold text-[#004d99] hover:bg-[#e6f4ff] transition-all shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">database</span>
              Vistas SQL Supabase
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigateToMap()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#004d99] text-white text-xs font-bold hover:bg-[#003d7a] transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            Ver en Plano
          </button>
        </div>
      </div>

      {/* 2. Barra Superior de Filtros Globales (Power BI Slicers Bar) */}
      <div className="bg-white border border-[#c2c6d4] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#475569]">
            <span className="material-symbols-outlined text-[16px] text-[#004d99]">filter_alt</span>
            Segmentadores Globales (Filtros Activos)
          </div>
          {(selectedArea !== 'TODOS' || selectedActa !== 'TODAS' || soloPendientes) && (
            <button
              type="button"
              onClick={() => {
                setSelectedArea('TODOS');
                setSelectedActa('TODAS');
                setSoloPendientes(false);
              }}
              className="text-xs text-[#004d99] hover:underline font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
              Limpiar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Slicer 1: Área / Sector */}
          <div className="md:col-span-5 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#64748b]">Área / Sector</span>
            <div className="flex flex-wrap gap-1 p-1 bg-[#f1f5f9] rounded-xl border border-[#cbd5e1]">
              {(['TODOS', 'I1', 'I2', 'TRONCAL', 'OTRO'] as const).map((areaKey) => {
                const isSelected = selectedArea === areaKey;
                return (
                  <button
                    key={areaKey}
                    type="button"
                    onClick={() => setSelectedArea(areaKey)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#004d99] text-white shadow-xs'
                        : 'text-[#334155] hover:bg-white hover:text-[#004d99]'
                    }`}
                  >
                    {areaKey === 'TODOS'
                      ? 'Todas'
                      : areaKey === 'I1'
                      ? 'Int 1 (I1)'
                      : areaKey === 'I2'
                      ? 'Int 2 (I2)'
                      : areaKey === 'TRONCAL'
                      ? 'Troncal'
                      : 'Otros'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slicer 2: Número de Acta */}
          <div className="md:col-span-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#64748b]">Auditoría por Acta</span>
            <select
              value={selectedActa}
              onChange={(e) => setSelectedActa(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#004d99]"
            >
              {globalMetrics.actasDisponibles.map((actaName) => (
                <option key={actaName} value={actaName}>
                  {actaName === 'TODAS' ? '📋 Todas las Actas' : `🔖 ${actaName}`}
                </option>
              ))}
            </select>
          </div>

          {/* Slicer 3: Toggle Mostrar solo Pendientes */}
          <div className="md:col-span-3 flex flex-col gap-1 justify-center">
            <span className="text-[11px] font-semibold text-[#64748b]">Estado Crítico</span>
            <button
              type="button"
              onClick={() => setSoloPendientes(!soloPendientes)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                soloPendientes
                  ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-400'
                  : 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1] hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-600">
                  {soloPendientes ? 'check_box' : 'check_box_outline_blank'}
                </span>
                Solo Pendientes
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white font-mono border">
                {globalMetrics.totalPendientes}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Sección KPI Header Cards (Al estilo Power BI) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* KPI 1: Tarjeta Principal Cámaras (Dinamizada por Filtro) */}
        <div className="lg:col-span-7 bg-white border border-[#c2c6d4] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <span className="material-symbols-outlined text-[20px]">videocam</span>
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">
                  Resumen de Cámaras ({activeSectorMetric.sectorName})
                </h3>
                <p className="text-[11px] text-[#64748b]">
                  {activeSectorMetric.camarasTerminadas} completadas · {activeSectorMetric.camarasEnProceso} en proceso · {activeSectorMetric.camarasNoIniciadas} no iniciadas (Total: {activeSectorMetric.camarasTotal})
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-[#004d99]">
                {activeSectorMetric.camarasAvancePonderado}%
              </span>
              <div className="text-[10px] font-bold text-[#64748b] uppercase">Avance Ponderado</div>
            </div>
          </div>

          {/* Barra de progreso global de cámaras */}
          <div className="w-full bg-[#f1f5f9] rounded-full h-2.5 mb-4 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${getProgressColor(activeSectorMetric.camarasAvancePonderado)}`}
              style={{ width: `${Math.min(100, activeSectorMetric.camarasAvancePonderado)}%` }}
            />
          </div>

          {/* 3 Mini Bloques Compactos (MT, BT, DATOS) en una sola tarjeta sin saturación */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {/* Media Tensión */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  MT
                </span>
                <span className="text-xs font-black text-[#1e293b]">{activeSectorMetric.mtAvance}%</span>
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold text-[#0f172a]">
                  {activeSectorMetric.mtTerminadas}
                  <span className="text-xs font-normal text-[#64748b]"> / {activeSectorMetric.mtTotal}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${activeSectorMetric.mtAvance}%` }} />
                </div>
              </div>
            </div>

            {/* Baja Tensión */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  BT
                </span>
                <span className="text-xs font-black text-[#1e293b]">{activeSectorMetric.btAvance}%</span>
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold text-[#0f172a]">
                  {activeSectorMetric.btTerminadas}
                  <span className="text-xs font-normal text-[#64748b]"> / {activeSectorMetric.btTotal}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                  <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: `${activeSectorMetric.btAvance}%` }} />
                </div>
              </div>
            </div>

            {/* Datos */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                  DATOS
                </span>
                <span className="text-xs font-black text-[#1e293b]">{activeSectorMetric.datosAvance}%</span>
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold text-[#0f172a]">
                  {activeSectorMetric.datosTerminadas}
                  <span className="text-xs font-normal text-[#64748b]"> / {activeSectorMetric.datosTotal}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                  <div className="bg-teal-600 h-1.5 rounded-full" style={{ width: `${activeSectorMetric.datosAvance}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Tarjeta Tramos de Tubería (Metros Lineales Reales) */}
        <div className="lg:col-span-5 bg-white border border-[#c2c6d4] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-teal-50 text-teal-700">
                  <span className="material-symbols-outlined text-[20px]">linear_scale</span>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">
                    Tubería e Infraestructura Lineal ({activeSectorMetric.sectorName})
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    {activeSectorMetric.tramosTotal} tramos · {activeSectorMetric.metrosTotales.toFixed(1)} m lineales reales ({activeSectorMetric.distanciaTrazaTotal.toFixed(1)} m zanja)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-teal-700">
                  {activeSectorMetric.metrosAvancePonderado}%
                </span>
                <div className="text-[10px] font-bold text-[#64748b] uppercase">Instalado</div>
              </div>
            </div>

            {/* Barra de progreso de tubería */}
            <div className="w-full bg-[#f1f5f9] rounded-full h-2.5 mb-4 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-teal-600 transition-all duration-500"
                style={{ width: `${Math.min(100, activeSectorMetric.metrosAvancePonderado)}%` }}
              />
            </div>

            {/* Indicadores en Metros Lineales Reales (Multiplicador x Distancia) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f0fdfa] border border-teal-200 rounded-xl p-3">
                <div className="text-[11px] font-bold text-teal-800 uppercase">Mts Lineales Ejecutados</div>
                <div className="text-xl font-black text-teal-900 mt-0.5">
                  {activeSectorMetric.metrosEjecutados.toFixed(1)} <span className="text-xs font-normal">m</span>
                </div>
                <div className="text-[10px] text-teal-700 mt-1">Multiplicador × Distancia × %</div>
              </div>

              <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3">
                <div className="text-[11px] font-bold text-slate-700 uppercase">Mts Lineales Reales</div>
                <div className="text-xl font-black text-slate-900 mt-0.5">
                  {activeSectorMetric.metrosTotales.toFixed(1)} <span className="text-xs font-normal">m</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-1">
                  Pendientes: {activeSectorMetric.metrosPendientes.toFixed(1)} m
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#64748b]">
            <span>Área: <strong className="text-[#0f172a]">{getSectorLabel(selectedArea)}</strong></span>
            <span>Acta: <strong className="text-[#0f172a]">{selectedActa}</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Sección Gráfica Analítica (Visuales Recharts al estilo Power BI) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Gráfico 1: Barras Compuestas (Ejecutado vs Pendiente por Zona) */}
        <div className="lg:col-span-7 bg-white border border-[#c2c6d4] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#004d99]">bar_chart</span>
                Avance Comparativo por Sectores
              </h3>
              <p className="text-xs text-[#64748b]">Elementos completados, en proceso y pendientes por cada zona</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartDataBarras}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="area"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value} elementos`,
                    name === 'completado' ? 'Terminado' : name === 'enProceso' ? 'En Proceso' : 'Pendiente',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar dataKey="completado" name="Terminado" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="enProceso" name="En Proceso" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pendiente" name="Pendiente" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Donut Chart de Estado y Auditoría de Actas */}
        <div className="lg:col-span-5 bg-white border border-[#c2c6d4] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#004d99]">pie_chart</span>
                Distribución Operativa
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {displayItems.length} Elementos
              </span>
            </div>
            <p className="text-xs text-[#64748b]">Estado físico actual y volumen de ítems</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            {chartDataDonut.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataDonut}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartDataDonut.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} unidades`, name]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-[#94a3b8]">No hay datos para la selección activa</div>
            )}
          </div>

          {/* Micro Auditoría por Actas */}
          <div className="mt-3 pt-3 border-t border-[#e2e8f0] space-y-1.5">
            <div className="text-[11px] font-bold text-[#475569] uppercase">Desglose por Actas:</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {chartActasDonut.slice(0, 3).map((actaItem) => (
                <div key={actaItem.acta} className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-600 truncate">{actaItem.acta}</div>
                  <div className="text-xs font-black text-slate-900 mt-0.5">{actaItem.total}</div>
                  <div className="text-[9px] text-amber-700">{actaItem.pendientes} pendientes</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Tabla de Detalle y Auditoría de Pendientes (Expandible y Filtrable) */}
      <div className="bg-white border border-[#c2c6d4] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e8f0] pb-4">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#004d99]">table_rows</span>
              Detalle de Elementos y Auditoría de Obra
            </h3>
            <p className="text-xs text-[#64748b]">
              Mostrando {displayItems.length} registros según los filtros seleccionados
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Tipo */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTableFilterType('TODOS')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  tableFilterType === 'TODOS' ? 'bg-white text-[#004d99] shadow-2xs' : 'text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setTableFilterType('CAMARA')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  tableFilterType === 'CAMARA' ? 'bg-white text-[#004d99] shadow-2xs' : 'text-slate-600'
                }`}
              >
                Cámaras
              </button>
              <button
                type="button"
                onClick={() => setTableFilterType('TUBERIA')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  tableFilterType === 'TUBERIA' ? 'bg-white text-[#004d99] shadow-2xs' : 'text-slate-600'
                }`}
              >
                Tramos
              </button>
            </div>

            {/* Buscador interno */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                search
              </span>
              <input
                type="text"
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                placeholder="Buscar código, tramo..."
                className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#0f172a] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004d99]"
              />
            </div>
          </div>
        </div>

        {/* Contenedor Tabular */}
        <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] text-[#475569] font-bold border-b border-[#e2e8f0]">
              <tr>
                <th className="py-2.5 px-3">Elemento</th>
                <th className="py-2.5 px-3">Tipo / Red</th>
                <th className="py-2.5 px-3">Sector</th>
                <th className="py-2.5 px-3">Acta</th>
                <th className="py-2.5 px-3">Metraje Real</th>
                <th className="py-2.5 px-3">% Avance</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Observación / Pendiente</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No se encontraron elementos con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                displayItems.slice(0, 50).map((photo) => {
                  const isCam = photo.elementType === 'camara' || (!photo.elementType && Boolean(photo.cameraCode));
                  const isTerminado = photo.executionStatus === 'Terminado';
                  const isEnProceso = photo.executionStatus === 'En proceso';
                  const progressPct = getPhotoProgressPercentage(photo);
                  const linearInfo = getPhotoRealLinearMeters(photo);
                  const realMeters = linearInfo.totalLinearMeters;
                  const multiplier = linearInfo.multiplier;

                  return (
                    <tr
                      key={photo.id}
                      onClick={() => onSelectPhoto(photo)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      {/* Nombre / ID */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#0f172a]">{photo.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{photo.displayId}</div>
                      </td>

                      {/* Tipo / Red */}
                      <td className="py-2.5 px-3">
                        {isCam ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <span className="material-symbols-outlined text-[14px] text-blue-600">videocam</span>
                            Cámara {photo.cameraType || 'MT'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                            <span className="material-symbols-outlined text-[14px] text-teal-600">linear_scale</span>
                            Tramo {photo.tramo || 'Ducto'}
                          </span>
                        )}
                      </td>

                      {/* Sector */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                          {photo.sector || (photo.name.includes('I1') ? 'Intersección 1' : photo.name.includes('I2') ? 'Intersección 2' : photo.name.includes('TRONCAL') ? 'Troncal' : 'Otros')}
                        </span>
                      </td>

                      {/* Acta */}
                      <td className="py-2.5 px-3">
                        <span className="text-slate-700 font-medium">
                          {photo.acta || <span className="text-slate-400 italic">Sin Acta</span>}
                        </span>
                      </td>

                      {/* Metraje Real */}
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        {!isCam && realMeters > 0 ? (
                          <div>
                            <span className="text-[#004d99] font-bold">{realMeters.toFixed(1)} m</span>
                            {multiplier > 1 && (
                              <span className="block text-[9px] text-slate-500 font-normal">
                                {multiplier}× ({photo.metraje} m)
                              </span>
                            )}
                          </div>
                        ) : photo.metraje ? (
                          `${photo.metraje} m`
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* % Avance */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 min-w-[70px]">
                          <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${getProgressColor(progressPct)}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-[11px] text-slate-700">
                            {progressPct}%
                          </span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isTerminado
                              ? 'bg-emerald-100 text-emerald-800'
                              : isEnProceso
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {photo.executionStatus || 'No iniciado'}
                        </span>
                      </td>

                      {/* Observación */}
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-600" title={photo.fieldNotes || ''}>
                        {photo.fieldNotes || <span className="text-slate-400 italic">Sin observaciones</span>}
                      </td>

                      {/* Acción */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToMap(photo);
                          }}
                          className="p-1 text-slate-400 hover:text-[#004d99] hover:bg-slate-100 rounded-lg"
                          title="Ubicar en el plano"
                        >
                          <span className="material-symbols-outlined text-[18px]">location_searching</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {displayItems.length > 50 && (
          <div className="text-center text-xs text-slate-500 py-1">
            Mostrando los primeros 50 de {displayItems.length} registros. Usa los filtros o buscador para acotar.
          </div>
        )}
      </div>
    </div>
  );
};
