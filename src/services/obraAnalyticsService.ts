import { InspectionPhoto, getPhotoProgressPercentage, getPhotoRealLinearMeters } from '../types';

export interface SectorMetric {
  sectorKey: 'TODOS' | 'I1' | 'I2' | 'TRONCAL' | 'OTRO';
  sectorName: string;
  // Cámaras MT, BT, DATOS
  camarasTotal: number;
  camarasTerminadas: number;
  camarasEnProceso: number;
  camarasNoIniciadas: number;
  camarasAvancePonderado: number; // 0 - 100%

  mtTotal: number;
  mtTerminadas: number;
  mtEnProceso: number;
  mtAvance: number;

  btTotal: number;
  btTerminadas: number;
  btEnProceso: number;
  btAvance: number;

  datosTotal: number;
  datosTerminadas: number;
  datosEnProceso: number;
  datosAvance: number;

  // Tramos y Ductería (Metros Lineales Reales = Multiplicador × Distancia)
  tramosTotal: number;
  metrosTotales: number; // Metros lineales reales totales (ej: 2x4" 100m = 200m)
  metrosEjecutados: number; // Metros lineales reales ejecutados (ponderado por % de avance)
  metrosPendientes: number;
  metrosAvancePonderado: number; // 0 - 100%
  distanciaTrazaTotal: number; // Distancia física de traza / zanja (sin multiplicar)
  distanciaTrazaEjecutada: number;

  // Actas
  itemsPorActa: Record<string, number>;
  pendientesPorActa: Record<string, number>;
}

export interface ObraGlobalMetrics {
  totalElementos: number;
  avanceGlobalPonderado: number; // 0 - 100%
  // Cámaras
  camarasTotal: number;
  camarasTerminadas: number;
  camarasEnProceso: number;
  camarasNoIniciadas: number;
  camarasAvancePonderado: number;

  mtTotal: number;
  mtTerminadas: number;
  mtAvance: number;

  btTotal: number;
  btTerminadas: number;
  btAvance: number;

  datosTotal: number;
  datosTerminadas: number;
  datosAvance: number;

  // Tubería
  tramosTotal: number;
  metrosTotales: number;
  metrosEjecutados: number;
  metrosPendientes: number;
  metrosAvancePonderado: number;
  distanciaTrazaTotal: number;
  distanciaTrazaEjecutada: number;

  // Resúmenes por Sector
  sectores: Record<'I1' | 'I2' | 'TRONCAL' | 'OTRO', SectorMetric>;

  // Actas registradas
  actasDisponibles: string[];
  totalPendientes: number;
}

/**
 * Normaliza el sector de un elemento según las reglas de negocio
 */
export const getElementSectorKey = (name?: string): 'I1' | 'I2' | 'TRONCAL' | 'OTRO' => {
  const upper = (name || '').toUpperCase();
  if (upper.includes('I1')) return 'I1';
  if (upper.includes('I2')) return 'I2';
  if (upper.includes('TRONCAL')) return 'TRONCAL';
  return 'OTRO';
};

export const getSectorLabel = (key: 'TODOS' | 'I1' | 'I2' | 'TRONCAL' | 'OTRO'): string => {
  switch (key) {
    case 'I1':
      return 'Intersección 1';
    case 'I2':
      return 'Intersección 2';
    case 'TRONCAL':
      return 'Troncal Principal';
    case 'OTRO':
      return 'Otros Sectores';
    case 'TODOS':
    default:
      return 'Toda la Obra';
  }
};

/**
 * Calcula las métricas de control de obra a partir de los elementos del plano/base de datos
 */
export function calculateObraMetrics(
  photos: InspectionPhoto[],
  filterArea: 'TODOS' | 'I1' | 'I2' | 'TRONCAL' | 'OTRO' = 'TODOS',
  filterActa: string = 'TODAS',
  soloPendientes: boolean = false
): {
  activeSectorMetric: SectorMetric;
  globalMetrics: ObraGlobalMetrics;
  filteredItems: InspectionPhoto[];
  chartDataBarras: Array<{
    area: string;
    areaKey: string;
    completado: number;
    enProceso: number;
    pendiente: number;
    avancePct: number;
  }>;
  chartDataDonut: Array<{
    name: string;
    value: number;
    color: string;
    estadoKey: string;
  }>;
  chartActasDonut: Array<{
    acta: string;
    total: number;
    pendientes: number;
    terminados: number;
  }>;
} {
  const actasSet = new Set<string>();

  // 1. Clasificación previa
  const allParsed = photos.map((p) => {
    const sectorKey = getElementSectorKey(p.name);
    const isCamara = p.elementType === 'camara' || (!p.elementType && Boolean(p.cameraCode));
    const isTuberia = p.elementType === 'tuberia' || (!p.elementType && Boolean(p.tramo || p.metraje));
    const isElectrical = p.elementType === 'electrico' || p.category === 'electrical';

    // Red
    const cType = (p.cameraType || '').toUpperCase();
    const isDatos = cType.includes('DATO') || cType === 'D' || p.pipeNetworkType === 'datos' || (p.name || '').toUpperCase().includes('_D_');
    const isBT = cType === 'BT' || p.pipeNetworkType === 'baja_tension' || (p.name || '').toUpperCase().includes('_BT');
    const isMT = (!isDatos && !isBT) || cType === 'MT' || p.pipeNetworkType === 'media_tension' || (p.name || '').toUpperCase().includes('_MT');

    // Estado & avance individual
    const execStatus = p.executionStatus || 'No iniciado';
    const progressPct = getPhotoProgressPercentage(p);
    const isTerminado = execStatus === 'Terminado' || progressPct === 100;
    const isEnProceso = !isTerminado && (execStatus === 'En proceso' || progressPct > 0);
    const isNoIniciado = !isTerminado && !isEnProceso;

    // Metraje para tuberías: Cálculo de metros lineales reales (multiplicador * distancia)
    const realMeters = isTuberia ? getPhotoRealLinearMeters(p) : { totalLinearMeters: 0, distanceMeters: 0, multiplier: 1 };
    const metrajeTotal = realMeters.totalLinearMeters;
    const distanciaTraza = realMeters.distanceMeters;
    const metrajeEjecutado = isTuberia
      ? Math.round(metrajeTotal * (progressPct / 100) * 100) / 100
      : 0;
    const distanciaTrazaEjecutada = isTuberia
      ? Math.round(distanciaTraza * (progressPct / 100) * 100) / 100
      : 0;

    const acta = p.acta && p.acta.trim() !== '' ? p.acta.trim() : 'Sin Acta';
    actasSet.add(acta);

    // ¿Tiene pendientes u observaciones sin subsanar?
    const hasPendiente = !isTerminado || p.status === 'Flagged' || Boolean(p.requiresImmediateAction);

    return {
      photo: p,
      sectorKey,
      isCamara,
      isTuberia,
      isElectrical,
      isMT,
      isBT,
      isDatos,
      execStatus,
      progressPct,
      isTerminado,
      isEnProceso,
      isNoIniciado,
      metrajeTotal,
      metrajeEjecutado,
      distanciaTraza,
      distanciaTrazaEjecutada,
      tramoMultiplier: realMeters.multiplier,
      acta,
      hasPendiente,
    };
  });

  // 2. Construir SectorMetric helper
  const createEmptySectorMetric = (key: 'TODOS' | 'I1' | 'I2' | 'TRONCAL' | 'OTRO', customName?: string): SectorMetric => ({
    sectorKey: key,
    sectorName: customName || getSectorLabel(key),
    camarasTotal: 0,
    camarasTerminadas: 0,
    camarasEnProceso: 0,
    camarasNoIniciadas: 0,
    camarasAvancePonderado: 0,
    mtTotal: 0,
    mtTerminadas: 0,
    mtEnProceso: 0,
    mtAvance: 0,
    btTotal: 0,
    btTerminadas: 0,
    btEnProceso: 0,
    btAvance: 0,
    datosTotal: 0,
    datosTerminadas: 0,
    datosEnProceso: 0,
    datosAvance: 0,
    tramosTotal: 0,
    metrosTotales: 0,
    metrosEjecutados: 0,
    metrosPendientes: 0,
    metrosAvancePonderado: 0,
    distanciaTrazaTotal: 0,
    distanciaTrazaEjecutada: 0,
    itemsPorActa: {},
    pendientesPorActa: {},
  });

  /**
   * Helper que computa un SectorMetric dado un array de elementos clasificados
   */
  const buildMetricForItems = (
    items: typeof allParsed,
    key: 'TODOS' | 'I1' | 'I2' | 'TRONCAL' | 'OTRO',
    customName?: string
  ): SectorMetric => {
    const s = createEmptySectorMetric(key, customName);
    let camPonderado = 0;
    let mtPonderado = 0;
    let btPonderado = 0;
    let datosPonderado = 0;

    items.forEach((item) => {
      s.itemsPorActa[item.acta] = (s.itemsPorActa[item.acta] || 0) + 1;
      if (item.hasPendiente) {
        s.pendientesPorActa[item.acta] = (s.pendientesPorActa[item.acta] || 0) + 1;
      }

      // Si es cámara
      if (item.isCamara) {
        s.camarasTotal++;

        // CRÍTICO: Si no está iniciado, la contribución es exactamente 0.
        // Si está terminado, 100%. Si está en proceso, progressPct (o 50 si no está especificado).
        const contribPct = item.isTerminado ? 100 : item.isEnProceso ? (item.progressPct > 0 ? item.progressPct : 50) : 0;
        camPonderado += contribPct;

        if (item.isTerminado) {
          s.camarasTerminadas++;
        } else if (item.isEnProceso) {
          s.camarasEnProceso++;
        } else {
          s.camarasNoIniciadas++;
        }

        // Red MT / BT / DATOS
        if (item.isDatos) {
          s.datosTotal++;
          datosPonderado += contribPct;
          if (item.isTerminado) s.datosTerminadas++;
          else if (item.isEnProceso) s.datosEnProceso++;
        } else if (item.isBT) {
          s.btTotal++;
          btPonderado += contribPct;
          if (item.isTerminado) s.btTerminadas++;
          else if (item.isEnProceso) s.btEnProceso++;
        } else {
          s.mtTotal++;
          mtPonderado += contribPct;
          if (item.isTerminado) s.mtTerminadas++;
          else if (item.isEnProceso) s.mtEnProceso++;
        }
      }

      // Si es tubería
      if (item.isTuberia) {
        s.tramosTotal++;
        s.metrosTotales += item.metrajeTotal;
        s.metrosEjecutados += item.metrajeEjecutado;
        s.distanciaTrazaTotal += item.distanciaTraza;
        s.distanciaTrazaEjecutada += item.distanciaTrazaEjecutada;
      }
    });

    s.camarasAvancePonderado = s.camarasTotal > 0 ? Math.round((camPonderado / (s.camarasTotal * 100)) * 1000) / 10 : 0;
    s.mtAvance = s.mtTotal > 0 ? Math.round((mtPonderado / (s.mtTotal * 100)) * 1000) / 10 : 0;
    s.btAvance = s.btTotal > 0 ? Math.round((btPonderado / (s.btTotal * 100)) * 1000) / 10 : 0;
    s.datosAvance = s.datosTotal > 0 ? Math.round((datosPonderado / (s.datosTotal * 100)) * 1000) / 10 : 0;

    s.metrosTotales = Math.round(s.metrosTotales * 100) / 100;
    s.metrosEjecutados = Math.round(s.metrosEjecutados * 100) / 100;
    s.metrosPendientes = Math.max(0, Math.round((s.metrosTotales - s.metrosEjecutados) * 100) / 100);
    s.metrosAvancePonderado = s.metrosTotales > 0 ? Math.round((s.metrosEjecutados / s.metrosTotales) * 1000) / 10 : 0;
    s.distanciaTrazaTotal = Math.round(s.distanciaTrazaTotal * 100) / 100;
    s.distanciaTrazaEjecutada = Math.round(s.distanciaTrazaEjecutada * 100) / 100;

    return s;
  };

  // Mapeos por sector con todos sus elementos (sin filtrar por acta)
  const sectoresMap: Record<'I1' | 'I2' | 'TRONCAL' | 'OTRO', SectorMetric> = {
    I1: buildMetricForItems(allParsed.filter((i) => i.sectorKey === 'I1'), 'I1'),
    I2: buildMetricForItems(allParsed.filter((i) => i.sectorKey === 'I2'), 'I2'),
    TRONCAL: buildMetricForItems(allParsed.filter((i) => i.sectorKey === 'TRONCAL'), 'TRONCAL'),
    OTRO: buildMetricForItems(allParsed.filter((i) => i.sectorKey === 'OTRO'), 'OTRO'),
  };

  const globalSector = buildMetricForItems(allParsed, 'TODOS');

  // Métrica activa dinamizada por los segmentadores (Área + Acta + Pendientes)
  const activeItems = allParsed.filter((item) => {
    if (filterArea !== 'TODOS' && item.sectorKey !== filterArea) return false;
    if (filterActa !== 'TODAS' && item.acta !== filterActa) return false;
    if (soloPendientes && !item.hasPendiente) return false;
    return true;
  });

  const activeLabel =
    getSectorLabel(filterArea) +
    (filterActa !== 'TODAS' ? ` · ${filterActa}` : '') +
    (soloPendientes ? ' (Solo Pendientes)' : '');

  const activeSectorMetric = buildMetricForItems(activeItems, filterArea, activeLabel);

  // Filtrar elementos para la tabla y gráficos de detalle
  const filteredItems = activeItems.map((item) => item.photo);

  // Avance global ponderado de obra (50% Cámaras, 50% Tubería)
  const pesoCamaras = activeSectorMetric.camarasTotal > 0 ? 0.6 : 0;
  const pesoMetros = activeSectorMetric.metrosTotales > 0 ? (pesoCamaras > 0 ? 0.4 : 1) : (pesoCamaras > 0 ? 1 : 0);
  const avanceGlobal = Math.round(
    activeSectorMetric.camarasAvancePonderado * pesoCamaras +
    activeSectorMetric.metrosAvancePonderado * pesoMetros
  );

  // Gráfica de Barras por Área (Intersección 1, Intersección 2, Troncal, Otros)
  const chartDataBarras = (['I1', 'I2', 'TRONCAL', 'OTRO'] as const).map((key) => {
    const s = sectoresMap[key];
    const itemsSector = allParsed.filter((i) => i.sectorKey === key);
    const comp = itemsSector.filter((i) => i.isTerminado).length;
    const proc = itemsSector.filter((i) => i.isEnProceso).length;
    const pend = itemsSector.filter((i) => i.isNoIniciado).length;
    const avancePct = itemsSector.length > 0 ? Math.round(((comp * 100 + proc * 50) / (itemsSector.length * 100)) * 100) : 0;

    return {
      area: getSectorLabel(key),
      areaKey: key,
      completado: comp,
      enProceso: proc,
      pendiente: pend,
      avancePct,
    };
  });

  // Gráfico Donut de Estados (filtrado según selección activa)
  const activeParsed = allParsed.filter((i) => {
    if (filterArea !== 'TODOS' && i.sectorKey !== filterArea) return false;
    if (filterActa !== 'TODAS' && i.acta !== filterActa) return false;
    return true;
  });

  const termCount = activeParsed.filter((i) => i.isTerminado).length;
  const procCount = activeParsed.filter((i) => i.isEnProceso).length;
  const pendCount = activeParsed.filter((i) => i.isNoIniciado).length;

  const chartDataDonut = [
    { name: 'Terminados', value: termCount, color: '#16a34a', estadoKey: 'Terminado' },
    { name: 'En Proceso', value: procCount, color: '#f59e0b', estadoKey: 'En proceso' },
    { name: 'No Iniciados', value: pendCount, color: '#64748b', estadoKey: 'No iniciado' },
  ].filter((d) => d.value > 0);

  // Gráfico Desglose por Actas
  const actasArr = Array.from(actasSet).sort();
  const chartActasDonut = actasArr.map((actaName) => {
    const itemsActa = activeParsed.filter((i) => i.acta === actaName);
    const pend = itemsActa.filter((i) => i.hasPendiente).length;
    const term = itemsActa.filter((i) => i.isTerminado).length;
    return {
      acta: actaName,
      total: itemsActa.length,
      pendientes: pend,
      terminados: term,
    };
  });

  const globalMetrics: ObraGlobalMetrics = {
    totalElementos: photos.length,
    avanceGlobalPonderado: avanceGlobal,
    camarasTotal: globalSector.camarasTotal,
    camarasTerminadas: globalSector.camarasTerminadas,
    camarasEnProceso: globalSector.camarasEnProceso,
    camarasNoIniciadas: globalSector.camarasNoIniciadas,
    camarasAvancePonderado: globalSector.camarasAvancePonderado,
    mtTotal: globalSector.mtTotal,
    mtTerminadas: globalSector.mtTerminadas,
    mtAvance: globalSector.mtAvance,
    btTotal: globalSector.btTotal,
    btTerminadas: globalSector.btTerminadas,
    btAvance: globalSector.btAvance,
    datosTotal: globalSector.datosTotal,
    datosTerminadas: globalSector.datosTerminadas,
    datosAvance: globalSector.datosAvance,
    tramosTotal: globalSector.tramosTotal,
    metrosTotales: globalSector.metrosTotales,
    metrosEjecutados: globalSector.metrosEjecutados,
    metrosPendientes: globalSector.metrosPendientes,
    metrosAvancePonderado: globalSector.metrosAvancePonderado,
    distanciaTrazaTotal: globalSector.distanciaTrazaTotal,
    distanciaTrazaEjecutada: globalSector.distanciaTrazaEjecutada,
    sectores: sectoresMap,
    actasDisponibles: ['TODAS', ...actasArr],
    totalPendientes: allParsed.filter((i) => i.hasPendiente).length,
  };

  return {
    activeSectorMetric,
    globalMetrics,
    filteredItems,
    chartDataBarras,
    chartDataDonut,
    chartActasDonut,
  };
}
