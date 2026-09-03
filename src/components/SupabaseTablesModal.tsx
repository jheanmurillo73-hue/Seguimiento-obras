import React, { useState, useEffect, useMemo } from 'react';
import { supabaseService, SupabaseConnectionStatus } from '../services/supabaseService';
import { getActiveSupabaseConfig, saveCustomSupabaseConfig, resetSupabaseConfig } from '../lib/supabase';
import { InspectionPhoto, InspectorProfile, getPhotoNetworkInfo, getElementSector, SectorCode } from '../types';

interface SupabaseTablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: InspectionPhoto[];
  inspector: InspectorProfile;
  onPhotosImported?: (photos: InspectionPhoto[]) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const SupabaseTablesModal: React.FC<SupabaseTablesModalProps> = ({
  isOpen,
  onClose,
  photos,
  inspector,
  onPhotosImported,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'resumen' | 'diagnostico' | 'sql' | 'connection' | 'sync'>('resumen');
  const [selectedTable, setSelectedTable] = useState<string>('v_resumen_camaras_interseccion');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedSectorSql, setCopiedSectorSql] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdatingSectors, setIsUpdatingSectors] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<'TODOS' | 'I1' | 'I2' | 'TRONCAL'>('TODOS');
  const [networkFilter, setNetworkFilter] = useState<'TODOS' | 'MT' | 'BT' | 'DATOS'>('TODOS');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  // Form for custom credentials
  const config = getActiveSupabaseConfig();
  const [inputUrl, setInputUrl] = useState(config.url);
  const [inputKey, setInputKey] = useState(config.anonKey);

  useEffect(() => {
    if (isOpen) {
      handleTestConnection();
      const currentConfig = getActiveSupabaseConfig();
      setInputUrl(currentConfig.url);
      setInputKey(currentConfig.anonKey);
    }
  }, [isOpen]);

  // Cálculos analíticos de cámaras por intersección, red, fecha, acta y estado
  const cameraSummaryData = useMemo(() => {
    const cameras = photos.filter(p => p.elementType === 'camara' || (!p.elementType && p.cameraCode));

    interface MatrixSector {
      sectorKey: 'I1' | 'I2' | 'TRONCAL' | 'OTRO';
      sectorName: string;
      total: number;
      mt: number;
      bt: number;
      datos: number;
      pendientes: number;
      enProceso: number;
      terminadas: number;
      acta1: number;
      acta2: number;
      acta3: number;
      sinActa: number;
      conFotos: number;
      sinFotos: number;
      porcentajeAvance: number;
    }

    const matrixMap: Record<string, MatrixSector> = {
      I1: {
        sectorKey: 'I1',
        sectorName: 'Intersección 1',
        total: 0,
        mt: 0,
        bt: 0,
        datos: 0,
        pendientes: 0,
        enProceso: 0,
        terminadas: 0,
        acta1: 0,
        acta2: 0,
        acta3: 0,
        sinActa: 0,
        conFotos: 0,
        sinFotos: 0,
        porcentajeAvance: 0,
      },
      I2: {
        sectorKey: 'I2',
        sectorName: 'Intersección 2',
        total: 0,
        mt: 0,
        bt: 0,
        datos: 0,
        pendientes: 0,
        enProceso: 0,
        terminadas: 0,
        acta1: 0,
        acta2: 0,
        acta3: 0,
        sinActa: 0,
        conFotos: 0,
        sinFotos: 0,
        porcentajeAvance: 0,
      },
      TRONCAL: {
        sectorKey: 'TRONCAL',
        sectorName: 'Troncal Principal',
        total: 0,
        mt: 0,
        bt: 0,
        datos: 0,
        pendientes: 0,
        enProceso: 0,
        terminadas: 0,
        acta1: 0,
        acta2: 0,
        acta3: 0,
        sinActa: 0,
        conFotos: 0,
        sinFotos: 0,
        porcentajeAvance: 0,
      },
      OTRO: {
        sectorKey: 'OTRO',
        sectorName: 'Otros Sectores',
        total: 0,
        mt: 0,
        bt: 0,
        datos: 0,
        pendientes: 0,
        enProceso: 0,
        terminadas: 0,
        acta1: 0,
        acta2: 0,
        acta3: 0,
        sinActa: 0,
        conFotos: 0,
        sinFotos: 0,
        porcentajeAvance: 0,
      },
    };

    interface DetailRow {
      key: string;
      sectorKey: 'I1' | 'I2' | 'TRONCAL' | 'OTRO';
      sectorName: string;
      net: 'MT' | 'BT' | 'DATOS';
      netLabel: string;
      status: string;
      acta: string;
      date: string;
      count: number;
      conFotos: number;
      elements: string[];
    }

    const detailMap: Record<string, DetailRow> = {};

    cameras.forEach(c => {
      const sectorInfo = getElementSector(c.name);
      const sKey: 'I1' | 'I2' | 'TRONCAL' | 'OTRO' = sectorInfo.code;
      const sName = sectorInfo.label;

      const m = matrixMap[sKey];
      m.total++;

      const netInfo = getPhotoNetworkInfo(c);
      const netType: 'MT' | 'BT' | 'DATOS' =
        netInfo.primary === 'DATOS' ? 'DATOS' : netInfo.primary === 'BT' ? 'BT' : 'MT';

      if (netType === 'MT') m.mt++;
      else if (netType === 'BT') m.bt++;
      else m.datos++;

      const status = c.executionStatus || 'No iniciado';
      if (status === 'Terminado') m.terminadas++;
      else if (status === 'En proceso') m.enProceso++;
      else m.pendientes++;

      const actaStr = (c.acta || '').trim();
      if (actaStr === 'Acta 1') m.acta1++;
      else if (actaStr === 'Acta 2') m.acta2++;
      else if (actaStr === 'Acta 3') m.acta3++;
      else m.sinActa++;

      const hasPhoto = Boolean((c.imageUrls && c.imageUrls.length > 0) || c.imageUrl);
      if (hasPhoto) m.conFotos++;
      else m.sinFotos++;

      const dateStr = c.date || 'Sin Fecha';
      const detailKey = `${sKey}__${netType}__${status}__${actaStr || 'Sin Acta'}__${dateStr}`;

      if (!detailMap[detailKey]) {
        detailMap[detailKey] = {
          key: detailKey,
          sectorKey: sKey,
          sectorName: sName,
          net: netType,
          netLabel: netType === 'DATOS' ? 'Datos / Control' : netType === 'BT' ? 'Baja Tensión' : 'Media Tensión',
          status,
          acta: actaStr || 'Sin Acta',
          date: dateStr,
          count: 0,
          conFotos: 0,
          elements: [],
        };
      }
      detailMap[detailKey].count++;
      if (hasPhoto) detailMap[detailKey].conFotos++;
      if (detailMap[detailKey].elements.length < 5 && c.name) {
        detailMap[detailKey].elements.push(c.name);
      }
    });

    // Calcular porcentajes
    Object.values(matrixMap).forEach(m => {
      if (m.total > 0) {
        m.porcentajeAvance = Math.round(((m.terminadas * 1.0 + m.enProceso * 0.5) / m.total) * 100);
      }
    });

    const matrixList = Object.values(matrixMap).filter(m => m.total > 0);
    const detailList = Object.values(detailMap).sort((a, b) => {
      if (a.sectorName !== b.sectorName) return a.sectorName.localeCompare(b.sectorName);
      if (a.net !== b.net) return a.net.localeCompare(b.net);
      return b.count - a.count;
    });

    return {
      totalCameras: cameras.length,
      matrix: matrixList,
      details: detailList,
      global: {
        mt: matrixList.reduce((acc, r) => acc + r.mt, 0),
        bt: matrixList.reduce((acc, r) => acc + r.bt, 0),
        datos: matrixList.reduce((acc, r) => acc + r.datos, 0),
        pendientes: matrixList.reduce((acc, r) => acc + r.pendientes, 0),
        enProceso: matrixList.reduce((acc, r) => acc + r.enProceso, 0),
        terminadas: matrixList.reduce((acc, r) => acc + r.terminadas, 0),
      },
    };
  }, [photos]);

  const tramosSummaryData = useMemo(() => {
    const pipes = photos.filter(p => p.elementType === 'tuberia' || Boolean(p.tramo));
    const matrixMap: Record<
      SectorCode,
      {
        sectorKey: SectorCode;
        sectorName: string;
        totalTramos: number;
        totalDuctos: number;
        totalMetros: number;
        mtMetros: number;
        btMetros: number;
        datosMetros: number;
      }
    > = {
      I1: { sectorKey: 'I1', sectorName: 'Intersección 1', totalTramos: 0, totalDuctos: 0, totalMetros: 0, mtMetros: 0, btMetros: 0, datosMetros: 0 },
      I2: { sectorKey: 'I2', sectorName: 'Intersección 2', totalTramos: 0, totalDuctos: 0, totalMetros: 0, mtMetros: 0, btMetros: 0, datosMetros: 0 },
      TRONCAL: { sectorKey: 'TRONCAL', sectorName: 'Troncal Principal', totalTramos: 0, totalDuctos: 0, totalMetros: 0, mtMetros: 0, btMetros: 0, datosMetros: 0 },
      OTRO: { sectorKey: 'OTRO', sectorName: 'Otros Sectores', totalTramos: 0, totalDuctos: 0, totalMetros: 0, mtMetros: 0, btMetros: 0, datosMetros: 0 },
    };

    pipes.forEach(p => {
      const sectorInfo = getElementSector(p.name);
      const sKey = sectorInfo.code;
      const m = matrixMap[sKey];
      m.totalTramos++;

      const conduits = (p.pipeConduits && p.pipeConduits.length > 0)
        ? p.pipeConduits
        : [{ networkType: p.pipeNetworkType || 'media_tension', meters: p.metraje || '0' }];

      conduits.forEach(c => {
        m.totalDuctos++;
        const meters = parseFloat(String(c.meters || '0')) || 0;
        m.totalMetros += meters;
        if (c.networkType === 'media_tension') m.mtMetros += meters;
        else if (c.networkType === 'baja_tension') m.btMetros += meters;
        else if (c.networkType === 'datos') m.datosMetros += meters;
      });
    });

    const matrixList = Object.values(matrixMap).filter(m => m.totalTramos > 0);
    return {
      totalPipes: pipes.length,
      matrix: matrixList,
      totalMetros: Math.round(matrixList.reduce((acc, r) => acc + r.totalMetros, 0) * 100) / 100,
      totalDuctos: matrixList.reduce((acc, r) => acc + r.totalDuctos, 0),
    };
  }, [photos]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const status = await supabaseService.testConnection();
      setConnectionStatus(status);
    } catch (err: any) {
      setConnectionStatus({
        connected: false,
        configured: false,
        message: `Error al probar conexión: ${err?.message || 'Error desconocido'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) {
      onShowToast('Por favor introduce la URL y Anon Key de Supabase', 'error');
      return;
    }
    saveCustomSupabaseConfig(inputUrl.trim(), inputKey.trim());
    onShowToast('Credenciales de Supabase guardadas', 'success');
    handleTestConnection();
  };

  const handleResetCredentials = () => {
    resetSupabaseConfig();
    const defaultCfg = getActiveSupabaseConfig();
    setInputUrl(defaultCfg.url);
    setInputKey(defaultCfg.anonKey);
    onShowToast('Credenciales restablecidas a valores de entorno', 'info');
    handleTestConnection();
  };

  const handleCopySql = () => {
    const sql = supabaseService.getSupabaseSchemaSql();
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    onShowToast('Script SQL copiado al portapapeles', 'success');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDownloadSql = () => {
    const sql = supabaseService.getSupabaseSchemaSql();
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photovault_supabase_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('Archivo photovault_supabase_schema.sql descargado', 'success');
  };

  const handleSyncAllToSupabase = async () => {
    if (photos.length === 0) {
      onShowToast('No hay registros locales para sincronizar.', 'info');
      return;
    }
    setIsSyncing(true);
    try {
      // Sync inspector profile first
      await supabaseService.syncProfile(inspector, inspector.id);
      
      // Bulk sync all photos
      const result = await supabaseService.bulkSyncPhotos(photos, inspector.id);
      if (result.success > 0) {
        onShowToast(`¡${result.success} registros de inspección sincronizados en Supabase!`, 'success');
      } else {
        onShowToast('No se pudieron sincronizar los registros o sus evidencias. Verifica las tablas, la sesión de Supabase y las políticas de Supabase Storage.', 'error');
      }
    } catch (err: any) {
      onShowToast(`Error de sincronización con Supabase Storage: ${err.message || 'Desconocido'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportFromSupabase = async () => {
    setIsImporting(true);
    try {
      const fetched = await supabaseService.fetchPhotos();
      if (fetched && fetched.length > 0) {
        if (onPhotosImported) {
          onPhotosImported(fetched);
        }
        onShowToast(`Se importaron ${fetched.length} inspecciones desde Supabase`, 'success');
      } else if (fetched && fetched.length === 0) {
        onShowToast('La tabla de Supabase está vacía. Sincroniza registros primero.', 'info');
      } else {
        onShowToast('No se pudieron obtener datos. Revisa que la tabla "inspection_photos" exista.', 'error');
      }
    } catch (err: any) {
      onShowToast(`Error al importar: ${err.message || 'Desconocido'}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpdateSectors = async () => {
    setIsUpdatingSectors(true);
    try {
      const result = await supabaseService.updateAllSectorsInSupabase();
      if (result.success) {
        onShowToast(result.message, 'success');
        if (onPhotosImported) {
          const fresh = await supabaseService.fetchPhotos();
          if (fresh && fresh.length > 0) {
            onPhotosImported(fresh);
          }
        }
      } else {
        onShowToast(result.message, 'error');
      }
    } catch (err: any) {
      onShowToast(`Error al actualizar sectores: ${err.message || 'Desconocido'}`, 'error');
    } finally {
      setIsUpdatingSectors(false);
    }
  };

  const tablesData: Record<
    string,
    {
      name: string;
      description: string;
      icon: string;
      columns: { name: string; type: string; constraints: string; description: string }[];
    }
  > = {
    inspection_photos: {
      name: 'inspection_photos',
      description: 'Almacena cada registro de fotografía e inspección técnica agregado por el inspector.',
      icon: 'photo_camera',
      columns: [
        { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'Identificador único del registro' },
        { name: 'display_id', type: 'TEXT', constraints: 'NOT NULL', description: 'Código legible de inspección (ej: INSP-2024-8842)' },
        { name: 'name', type: 'TEXT', constraints: 'NOT NULL', description: 'Título o nombre de la inspección' },
        { name: 'image_url', type: 'TEXT', constraints: 'NOT NULL', description: 'URL o Base64 de la fotografía capturada' },
        { name: 'date', type: 'TEXT', constraints: 'NOT NULL', description: 'Fecha legible formateada' },
        { name: 'date_raw', type: 'TEXT', constraints: 'NULL', description: 'Timestamp de fecha ISO 8601' },
        { name: 'status', type: 'TEXT', constraints: "CHECK ('Synced', 'In Progress', 'Flagged')", description: 'Estado de sincronización' },
        { name: 'execution_status', type: 'TEXT', constraints: "CHECK ('No iniciado', 'En proceso', 'Terminado')", description: 'Estado operativo del trabajo en campo' },
        { name: 'category', type: 'TEXT', constraints: 'NOT NULL', description: 'Categoría interna (structural, electrical, etc.)' },
        { name: 'category_label', type: 'TEXT', constraints: 'NOT NULL', description: 'Etiqueta legible de la categoría' },
        { name: 'location', type: 'TEXT', constraints: 'NOT NULL', description: 'Ubicación física / Bodega' },
        { name: 'element_type', type: 'TEXT', constraints: "CHECK ('caja', 'camara', 'tuberia', 'electrico')", description: 'Clasificación persistente del elemento en el plano' },
        { name: 'camera_code', type: 'TEXT', constraints: 'DEFAULT SB850', description: 'Código de cámara o celda (SB850, SB851, SB858)' },
        { name: 'camera_type', type: 'TEXT', constraints: 'DEFAULT MT', description: 'Tipo de cámara (MT, BT, Datos)' },
        { name: 'tramo', type: 'TEXT', constraints: 'NULL', description: 'Tramo de tubería (ej: 3x4", 2x6")' },
        { name: 'metraje', type: 'TEXT', constraints: 'NULL', description: 'Metraje o longitud del tramo en metros (ej: 12, 25.5)' },
        { name: 'pipe_network_type', type: 'TEXT', constraints: "CHECK ('media_tension', 'baja_tension', 'datos')", description: 'Tipo principal de red de canalización' },
        { name: 'pipe_conduits', type: 'JSONB', constraints: "DEFAULT '[]'::jsonb", description: 'Ductos detallados por red: id, networkType (media_tension / baja_tension / datos), configuration (ej. 2x4", 3x4") y metros' },
        { name: 'sector', type: 'TEXT', constraints: 'NULL', description: 'Sector clasificado (Intersección 1, Intersección 2, Troncal Principal, Otros Sectores)' },
        { name: 'sector_code', type: 'TEXT', constraints: 'NULL', description: 'Código del sector (I1, I2, TRONCAL, OTRO)' },
        { name: 'has_media_tension', type: 'BOOLEAN', constraints: 'DEFAULT false', description: 'Indica si el tramo contiene ducto(s) de Media Tensión' },
        { name: 'has_datos', type: 'BOOLEAN', constraints: 'DEFAULT false', description: 'Indica si el tramo contiene ducto(s) de Datos / Control' },
        { name: 'has_baja_tension', type: 'BOOLEAN', constraints: 'DEFAULT false', description: 'Indica si el tramo contiene ducto(s) de Baja Tensión' },
        { name: 'redes_list', type: 'TEXT', constraints: 'NULL', description: 'Lista legible de redes presentes en la zanja (ej: "MT, DATOS")' },
        { name: 'inspector_name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre completo del inspector' },
        { name: 'inspector_id', type: 'TEXT', constraints: 'NOT NULL', description: 'Cédula / Identificación del inspector' },
        { name: 'inspector_avatar', type: 'TEXT', constraints: 'NULL', description: 'Foto de perfil del inspector' },
        { name: 'type', type: 'TEXT', constraints: 'DEFAULT Fotografía', description: 'Tipo de documento o elemento' },
        { name: 'verified', type: 'BOOLEAN', constraints: 'DEFAULT false', description: 'Indica si fue verificado por supervisor' },
        { name: 'field_notes', type: 'TEXT', constraints: 'NULL', description: 'Notas técnicas y observaciones del inspector' },
        { name: 'requires_immediate_action', type: 'BOOLEAN', constraints: 'DEFAULT false', description: 'Bandera de alerta crítica de seguridad' },
        { name: 'file_size', type: 'TEXT', constraints: 'NULL', description: 'Tamaño del archivo fotográfico' },
        { name: 'resolution', type: 'TEXT', constraints: 'NULL', description: 'Resolución de la imagen' },
        { name: 'user_id', type: 'TEXT', constraints: 'NULL', description: 'ID de usuario para vinculación' },
        { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()', description: 'Fecha de creación en base de datos' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()', description: 'Última actualización' },
      ],
    },
    profiles: {
      name: 'profiles',
      description: 'Credenciales, datos de contacto y roles de los inspectores autorizados.',
      icon: 'badge',
      columns: [
        { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID del inspector o UUID de autenticación' },
        { name: 'name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre completo' },
        { name: 'email', type: 'TEXT', constraints: 'NOT NULL', description: 'Correo electrónico institucional' },
        { name: 'role', type: 'TEXT', constraints: 'DEFAULT Inspector', description: 'Cargo / Especialidad técnica' },
        { name: 'terminal', type: 'TEXT', constraints: 'DEFAULT Terminal A-12', description: 'Terminal o base asignada' },
        { name: 'department', type: 'TEXT', constraints: 'NOT NULL', description: 'Departamento o área' },
        { name: 'phone', type: 'TEXT', constraints: 'NULL', description: 'Teléfono de contacto en campo' },
        { name: 'avatar_url', type: 'TEXT', constraints: 'NULL', description: 'URL de fotografía o credencial' },
        { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()', description: 'Fecha de registro' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()', description: 'Última actualización' },
      ],
    },
    inspection_activities: {
      name: 'inspection_activities',
      description: 'Pista de auditoría de todas las acciones realizadas (subidas, cambios de estado, notas).',
      icon: 'history_edu',
      columns: [
        { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'Identificador único de la actividad' },
        { name: 'timestamp', type: 'TEXT', constraints: 'NOT NULL', description: 'Hora / tiempo transcurrido' },
        { name: 'action', type: 'TEXT', constraints: 'NOT NULL', description: 'Descripción de la acción efectuada' },
        { name: 'photo_name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre de la foto inspeccionada' },
        { name: 'photo_id', type: 'TEXT', constraints: 'NOT NULL', description: 'ID de la inspección vinculada' },
        { name: 'user_name', type: 'TEXT', constraints: 'NOT NULL', description: 'Inspector que ejecutó la acción' },
        { name: 'type', type: 'TEXT', constraints: "CHECK ('upload', 'sync', 'edit', 'flag', 'verified')", description: 'Tipo de evento de auditoría' },
        { name: 'sector', type: 'TEXT', constraints: 'NULL', description: 'Sector clasificado del elemento' },
        { name: 'sector_code', type: 'TEXT', constraints: 'NULL', description: 'Código de sector (I1, I2, TRONCAL, OTRO)' },
        { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()', description: 'Timestamp exacto' },
      ],
    },
    inspection_collections: {
      name: 'inspection_collections',
      description: 'Agrupaciones y carpetas temáticas de registros de inspección.',
      icon: 'folder_special',
      columns: [
        { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID de la colección' },
        { name: 'title', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre de la carpeta o proyecto' },
        { name: 'description', type: 'TEXT', constraints: 'NULL', description: 'Descripción de alcance' },
        { name: 'item_count', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Cantidad de fotos contenidas' },
        { name: 'cover_image', type: 'TEXT', constraints: 'NULL', description: 'Imagen de portada' },
        { name: 'category', type: 'TEXT', constraints: 'DEFAULT general', description: 'Categoría de agrupación' },
        { name: 'last_updated', type: 'TEXT', constraints: 'NOT NULL', description: 'Fecha de última modificación' },
        { name: 'photo_ids', type: 'JSONB', constraints: "DEFAULT '[]'::jsonb", description: 'Array de IDs de fotos asociadas' },
        { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()', description: 'Fecha de creación' },
      ],
    },
    app_settings: {
      name: 'app_settings',
      description: 'Preferencias de sincronización, Wi-Fi y políticas de guardado del inspector.',
      icon: 'tune',
      columns: [
        { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'Identificador de la configuración' },
        { name: 'email_notifications', type: 'BOOLEAN', constraints: 'DEFAULT true', description: 'Alertas por correo' },
        { name: 'push_notifications', type: 'BOOLEAN', constraints: 'DEFAULT false', description: 'Notificaciones móviles push' },
        { name: 'sync_wifi_only', type: 'BOOLEAN', constraints: 'DEFAULT true', description: 'Sincronizar sólo en Wi-Fi' },
        { name: 'high_quality_uploads', type: 'BOOLEAN', constraints: 'DEFAULT false', description: 'Carga en alta resolución' },
        { name: 'auto_verify_passed', type: 'BOOLEAN', constraints: 'DEFAULT true', description: 'Auto-verificación de elementos sin anomalías' },
        { name: 'offline_storage_limit_mb', type: 'INTEGER', constraints: 'DEFAULT 500', description: 'Límite de memoria caché en MB' },
      ],
    },
    v_tramos_conduits: {
      name: 'v_tramos_conduits (Vista SQL)',
      description: 'Vista PostgreSQL que desglosa cada ducto de canalización de pipe_conduits en una fila propia clasificada por red (MT, BT o DATOS).',
      icon: 'alt_route',
      columns: [
        { name: 'photo_id', type: 'TEXT', constraints: 'FOREIGN KEY', description: 'ID de la inspección / tramo físico' },
        { name: 'tramo_nombre', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre o código del tramo (ej: T25_I1, T42_TRONCAL)' },
        { name: 'red_codigo', type: 'TEXT', constraints: "'media_tension' | 'baja_tension' | 'datos'", description: 'Código de red del ducto' },
        { name: 'red_label', type: 'TEXT', constraints: 'NOT NULL', description: 'Etiqueta legible: Media Tensión (MT), Datos / Control o Baja Tensión (BT)' },
        { name: 'diametro_configuracion', type: 'TEXT', constraints: 'NOT NULL', description: 'Configuración de ducto (ej: 2x4", 3x4", 8x6")' },
        { name: 'metraje_metros', type: 'NUMERIC', constraints: 'NOT NULL', description: 'Metraje individual del ducto en metros' },
        { name: 'execution_status', type: 'TEXT', constraints: 'NULL', description: 'Estado operativo del tramo' },
        { name: 'location', type: 'TEXT', constraints: 'NULL', description: 'Ubicación o bodega' },
      ],
    },
    v_tramos_datos: {
      name: 'v_tramos_datos (Vista SQL)',
      description: 'Vista filtrada exclusivamente con los tramos y ductos de la red de DATOS y CONTROL.',
      icon: 'lan',
      columns: [
        { name: 'photo_id', type: 'TEXT', constraints: 'FOREIGN KEY', description: 'ID de la inspección' },
        { name: 'tramo_nombre', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre del tramo con canalización de Datos' },
        { name: 'red_codigo', type: 'TEXT', constraints: "= 'datos'", description: 'Filtro fijo de red de datos' },
        { name: 'diametro_configuracion', type: 'TEXT', constraints: 'NOT NULL', description: 'Ductos de datos (ej: 3x4", 2x4")' },
        { name: 'metraje_metros', type: 'NUMERIC', constraints: 'NOT NULL', description: 'Longitud del ducto de datos en metros' },
        { name: 'execution_status', type: 'TEXT', constraints: 'NULL', description: 'Estado operativo' },
      ],
    },
    v_resumen_redes: {
      name: 'v_resumen_redes (Vista SQL)',
      description: 'Resumen consolidado de métricas: total de metros lineales y cantidad de ductos por cada red (MT, BT y Datos).',
      icon: 'analytics',
      columns: [
        { name: 'red_label', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre de la red (Media Tensión, Datos / Control, Baja Tensión)' },
        { name: 'red_codigo', type: 'TEXT', constraints: 'NOT NULL', description: 'Código (media_tension, datos, baja_tension)' },
        { name: 'total_ductos', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cantidad total de canalizaciones de esa red' },
        { name: 'total_metros', type: 'NUMERIC', constraints: 'NOT NULL', description: 'Suma acumulada de metros lineales ejecutados' },
        { name: 'total_tramos_fisicos', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cantidad de zanjas o tramos físicos que contienen la red' },
      ],
    },
    v_resumen_camaras_interseccion: {
      name: 'v_resumen_camaras_interseccion (Vista SQL Resumen)',
      description: 'Resumen multidimensional que agrupa y cuenta cuántas cámaras hay en cada intersección según tipo (MT, BT o Datos), fecha, acta y estado.',
      icon: 'analytics',
      columns: [
        { name: 'sector', type: 'TEXT', constraints: "'Intersección 1' | 'Intersección 2' | 'Troncal Principal'", description: 'Sector o intersección deducida del elemento' },
        { name: 'tipo_red', type: 'TEXT', constraints: "'MT' | 'BT' | 'DATOS'", description: 'Red de infraestructura de la cámara' },
        { name: 'estado_ejecucion', type: 'TEXT', constraints: "'No iniciado' | 'En proceso' | 'Terminado'", description: 'Estado actual de la cámara' },
        { name: 'acta', type: 'TEXT', constraints: "'Acta 1' | 'Acta 2' | 'Sin Acta'", description: 'Acta contractual asignada' },
        { name: 'fecha_inspeccion', type: 'TEXT', constraints: 'YYYY-MM-DD', description: 'Fecha de inspección' },
        { name: 'total_camaras', type: 'BIGINT', constraints: 'NOT NULL', description: 'Número total de cámaras en ese grupo' },
        { name: 'con_fotos', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras que tienen evidencia fotográfica' },
        { name: 'pendientes_fotos', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras que aún no tienen fotos cargadas' },
      ],
    },
    v_matriz_camaras_por_sector: {
      name: 'v_matriz_camaras_por_sector (Vista SQL Matriz)',
      description: 'Matriz consolidada en formato de columnas directas: total cámaras, MT, BT, Datos, pendientes, en progreso, terminadas y avance por intersección.',
      icon: 'pivot_table_chart',
      columns: [
        { name: 'sector', type: 'TEXT', constraints: 'PRIMARY GROUP', description: 'Sector (Intersección 1, Intersección 2, Troncal)' },
        { name: 'total_camaras', type: 'BIGINT', constraints: 'NOT NULL', description: 'Total de cámaras en el sector' },
        { name: 'camaras_mt', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras de Media Tensión (MT)' },
        { name: 'camaras_bt', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras de Baja Tensión (BT)' },
        { name: 'camaras_datos', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras de Datos / Control' },
        { name: 'pendientes_no_iniciado', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras sin iniciar' },
        { name: 'en_progreso', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras en ejecución activa' },
        { name: 'terminadas', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras concluidas y verificadas' },
        { name: 'en_acta_1', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras cargadas a Acta 1' },
        { name: 'en_acta_2', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras cargadas a Acta 2' },
        { name: 'sin_acta', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cámaras aún sin asociar a acta' },
        { name: 'porcentaje_avance_estimado', type: 'NUMERIC', constraints: '0 - 100%', description: 'Porcentaje de avance físico estimado' },
      ],
    },
    v_camaras_inventario: {
      name: 'v_camaras_inventario (Vista SQL Inventario)',
      description: 'Inventario normalizado de cada cámara física con su sector (I1, I2, Troncal), red (MT, BT, Datos), ubicación y fotos sin mezclar tuberías ni cables.',
      icon: 'videocam',
      columns: [
        { name: 'photo_id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID de la inspección' },
        { name: 'nombre_completo', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre completo (ej: C8_BT_I1, C50A_BT_I2)' },
        { name: 'codigo_camara', type: 'TEXT', constraints: 'NULL', description: 'Código de cámara (ej: SB850)' },
        { name: 'sector_codigo', type: 'TEXT', constraints: "'I1' | 'I2' | 'TRONCAL' | 'OTRO'", description: 'Código corto de sector' },
        { name: 'sector_nombre', type: 'TEXT', constraints: 'NOT NULL', description: 'Nombre legible del sector / intersección' },
        { name: 'tipo_red', type: 'TEXT', constraints: "'MT' | 'BT' | 'DATOS'", description: 'Tipo de red resumida' },
        { name: 'red_label', type: 'TEXT', constraints: 'NOT NULL', description: 'Etiqueta legible de red' },
        { name: 'estado_ejecucion', type: 'TEXT', constraints: 'NOT NULL', description: 'Estado operativo' },
        { name: 'acta', type: 'TEXT', constraints: 'NULL', description: 'Acta asignada' },
        { name: 'fecha_inspeccion', type: 'TEXT', constraints: 'NULL', description: 'Fecha de captura' },
        { name: 'bodega_ubicacion', type: 'TEXT', constraints: 'NULL', description: 'Ubicación física o bodega' },
        { name: 'tiene_fotos', type: 'BOOLEAN', constraints: 'NOT NULL', description: 'Indica si cuenta con fotos cargadas' },
      ],
    },
    v_resumen_global_por_acta: {
      name: 'v_resumen_global_por_acta (Vista SQL por Acta)',
      description: 'Resumen ejecutivo de avance contractual agrupando cámaras, tramos de tubería y metros ejecutados por cada Acta y Sector.',
      icon: 'description',
      columns: [
        { name: 'acta', type: 'TEXT', constraints: 'GROUP KEY', description: 'Nombre del Acta (Acta 1, Acta 2, Sin Acta)' },
        { name: 'sector', type: 'TEXT', constraints: 'GROUP KEY', description: 'Sector o Intersección' },
        { name: 'total_camaras', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cantidad de cámaras' },
        { name: 'total_tramos', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cantidad de tramos de tubería' },
        { name: 'metros_tuberias', type: 'NUMERIC', constraints: 'METROS', description: 'Metros lineales acumulados de zanja/tubería' },
        { name: 'elementos_terminados', type: 'BIGINT', constraints: 'NOT NULL', description: 'Elementos terminados' },
        { name: 'elementos_en_proceso', type: 'BIGINT', constraints: 'NOT NULL', description: 'Elementos en proceso' },
        { name: 'elementos_pendientes', type: 'BIGINT', constraints: 'NOT NULL', description: 'Elementos pendientes' },
      ],
    },
    v_resumen_tramos_interseccion: {
      name: 'v_resumen_tramos_interseccion (Vista SQL Tramos por Sector)',
      description: 'Resumen analítico de canalizaciones y tramos de tubería agrupados por Intersección 1 (I1), Intersección 2 (I2) y Área Troncal (TRONCAL), desglosando metros lineales de MT, BT y Datos.',
      icon: 'linear_scale',
      columns: [
        { name: 'sector', type: 'TEXT', constraints: 'GROUP KEY', description: 'Nombre del Sector / Intersección' },
        { name: 'sector_codigo', type: 'TEXT', constraints: "'I1' | 'I2' | 'TRONCAL' | 'OTRO'", description: 'Código corto de sector' },
        { name: 'total_tramos_fisicos', type: 'BIGINT', constraints: 'NOT NULL', description: 'Número de tramos o zanjas físicas' },
        { name: 'total_ductos', type: 'BIGINT', constraints: 'NOT NULL', description: 'Cantidad total de ductos individuales' },
        { name: 'total_metros_lineales', type: 'NUMERIC', constraints: 'METROS', description: 'Metros lineales acumulados' },
        { name: 'metros_mt', type: 'NUMERIC', constraints: 'METROS', description: 'Metros de ductos para Media Tensión' },
        { name: 'metros_bt', type: 'NUMERIC', constraints: 'METROS', description: 'Metros de ductos para Baja Tensión' },
        { name: 'metros_datos', type: 'NUMERIC', constraints: 'METROS', description: 'Metros de ductos para Datos / Control' },
      ],
    },
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-[#c2c6d4] shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#002d5b] text-white px-5 py-4 flex items-center justify-between border-b border-[#004d99]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#90caf9]">
              <span className="material-symbols-outlined text-[24px]">database</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-['Hanken_Grotesk'] font-bold text-lg sm:text-xl leading-tight">
                  Tablas y Esquema de Supabase
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#1565c0] text-[#e3f2fd]">
                  PostgreSQL
                </span>
              </div>
              <p className="text-[12px] text-white/80 font-['Inter']">
                Estructura de base de datos para almacenar cada registro agregado por el inspector
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-[#f5f9fc] px-5 border-b border-[#c2c6d4] flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('resumen')}
            className={`py-3 px-3.5 border-b-2 font-['Inter'] text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'resumen'
                ? 'border-[#004d99] text-[#004d99]'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            Resumen Cámaras & Intersecciones
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-[#004d99]">
              {cameraSummaryData.totalCameras}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostico')}
            className={`py-3 px-3.5 border-b-2 font-['Inter'] text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'diagnostico'
                ? 'border-[#004d99] text-[#004d99]'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">schema</span>
            Diagnóstico & Arquitectura
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Anti-Flat
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tables')}
            className={`py-3 px-3.5 border-b-2 font-['Inter'] text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'tables'
                ? 'border-[#004d99] text-[#004d99]'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            Tablas & Vistas SQL ({Object.keys(tablesData).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-3.5 border-b-2 font-['Inter'] text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-[#004d99] text-[#004d99]'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            Script SQL para Supabase
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`py-3 px-3.5 border-b-2 font-['Inter'] text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'sync'
                ? 'border-[#004d99] text-[#004d99]'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">sync_alt</span>
            Sincronización ({photos.length} fotos)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            className={`py-3 px-3.5 border-b-2 font-['Inter'] text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'connection'
                ? 'border-[#004d99] text-[#004d99]'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">cloud_sync</span>
            Estado & Credenciales
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 bg-[#fbfdff]">
          {/* TAB 0: RESUMEN DE CÁMARAS POR INTERSECCIÓN, RED Y ESTADO */}
          {activeTab === 'resumen' && (() => {
            const filteredDetails = cameraSummaryData.details.filter(row => {
              if (sectorFilter !== 'TODOS' && row.sectorKey !== sectorFilter) return false;
              if (networkFilter !== 'TODOS' && row.net !== networkFilter) return false;
              if (statusFilter !== 'TODOS' && row.status !== statusFilter) return false;
              return true;
            });

            const activeMetrics = {
              totalCameras: filteredDetails.reduce((sum, r) => sum + r.count, 0),
              mt: filteredDetails.filter(r => r.net === 'MT').reduce((sum, r) => sum + r.count, 0),
              bt: filteredDetails.filter(r => r.net === 'BT').reduce((sum, r) => sum + r.count, 0),
              datos: filteredDetails.filter(r => r.net === 'DATOS').reduce((sum, r) => sum + r.count, 0),
              conFotos: filteredDetails.reduce((sum, r) => sum + r.conFotos, 0),
              terminadas: filteredDetails.filter(r => r.status === 'Terminado').reduce((sum, r) => sum + r.count, 0),
              enProceso: filteredDetails.filter(r => r.status === 'En proceso').reduce((sum, r) => sum + r.count, 0),
              pendientes: filteredDetails.filter(r => r.status !== 'Terminado' && r.status !== 'En proceso').reduce((sum, r) => sum + r.count, 0),
            };

            return (
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-blue-100 uppercase tracking-wider">
                        Vistas PostgreSQL Listas
                      </span>
                      <span className="text-[12px] text-blue-200">
                        {cameraSummaryData.totalCameras} Cámaras Totales Identificadas
                      </span>
                    </div>
                    <h3 className="text-[18px] font-['Hanken_Grotesk'] font-bold leading-snug">
                      Resumen Ejecutivo de Cámaras por Intersección y Tipo de Red
                    </h3>
                    <p className="text-[12px] text-blue-100 max-w-2xl leading-relaxed">
                      Estructura generada en Supabase mediante las vistas <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">v_matriz_camaras_por_sector</code> y <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">v_resumen_camaras_interseccion</code> para desglosar por Intersección 1, 2 o Troncal según MT, BT o Datos, actas y estado operativo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('sql')}
                      className="px-3 py-2 bg-white text-[#002d5b] hover:bg-blue-50 font-bold text-[12px] rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">terminal</span>
                      Ver Código SQL
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('diagnostico')}
                      className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white font-bold text-[12px] rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">schema</span>
                      Diagnóstico Tablas
                    </button>
                  </div>
                </div>

                {/* Sector Rule Callout Banner */}
                <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#dbeafe] text-[#1d4ed8] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">lightbulb</span>
                    </div>
                    <div>
                      <div className="font-bold text-[13px] text-[#1e3a8a] flex items-center gap-2">
                        <span>Regla de Clasificación de Sectores por Nombre</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-200 text-blue-900 font-mono font-semibold">
                          Cámaras y Tuberías
                        </span>
                      </div>
                      <div className="text-[12px] text-[#1e40af] mt-0.5">
                        Detecta automáticamente el sector analizando el nombre de la cámara o tramo:
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100 border border-blue-300 text-blue-900 text-[12px] font-semibold">
                      <span className="font-mono font-bold">I1</span> ➔ Intersección 1
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-100 border border-indigo-300 text-indigo-900 text-[12px] font-semibold">
                      <span className="font-mono font-bold">I2</span> ➔ Intersección 2
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 text-[12px] font-semibold">
                      <span className="font-mono font-bold">TRONCAL</span> ➔ Área Troncal
                    </span>
                  </div>
                </div>

                {/* Filters Section */}
                <div className="bg-white p-4 rounded-xl border border-[#c2c6d4] shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#004d99]">filter_alt</span>
                      <span className="font-bold text-[13px] text-[#071e27]">Filtrar Resumen en Vivo:</span>
                    </div>
                    {(sectorFilter !== 'TODOS' || networkFilter !== 'TODOS' || statusFilter !== 'TODOS') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSectorFilter('TODOS');
                          setNetworkFilter('TODOS');
                          setStatusFilter('TODOS');
                        }}
                        className="text-[11px] font-bold text-[#004d99] hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">refresh</span>
                        Limpiar Filtros
                      </button>
                    )}
                  </div>

                  {/* Sector Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[12px] font-medium text-[#727782] min-w-[70px]">Sector:</span>
                    <button
                      type="button"
                      onClick={() => setSectorFilter('TODOS')}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        sectorFilter === 'TODOS'
                          ? 'bg-[#004d99] text-white shadow-xs'
                          : 'bg-[#f0f4f9] text-[#424752] hover:bg-[#e4ebf5]'
                      }`}
                    >
                      Todos ({cameraSummaryData.totalCameras})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSectorFilter('I1')}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        sectorFilter === 'I1'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      Intersección 1 ({cameraSummaryData.matrix.find(m => m.sectorKey === 'I1')?.total || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSectorFilter('I2')}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        sectorFilter === 'I2'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
                      }`}
                    >
                      Intersección 2 ({cameraSummaryData.matrix.find(m => m.sectorKey === 'I2')?.total || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSectorFilter('TRONCAL')}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        sectorFilter === 'TRONCAL'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      Troncal Principal ({cameraSummaryData.matrix.find(m => m.sectorKey === 'TRONCAL')?.total || 0})
                    </button>
                  </div>

                  {/* Red & Estado dropdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <label className="text-[12px] font-medium text-[#727782] min-w-[70px]">Tipo de Red:</label>
                      <select
                        value={networkFilter}
                        onChange={(e) => setNetworkFilter(e.target.value as any)}
                        className="flex-1 px-3 py-1.5 bg-[#f8fafc] border border-[#c2c6d4] rounded-lg text-[12px] text-[#071e27] focus:outline-none focus:border-[#004d99]"
                      >
                        <option value="TODOS">Todas las redes (MT, BT y Datos)</option>
                        <option value="MT">Media Tensión (MT)</option>
                        <option value="BT">Baja Tensión (BT)</option>
                        <option value="DATOS">Datos / Control</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[12px] font-medium text-[#727782] min-w-[70px]">Estado:</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#f8fafc] border border-[#c2c6d4] rounded-lg text-[12px] text-[#071e27] focus:outline-none focus:border-[#004d99]"
                      >
                        <option value="TODOS">Todos los estados</option>
                        <option value="No iniciado">No iniciado / Pendiente</option>
                        <option value="En proceso">En proceso</option>
                        <option value="Terminado">Terminado</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* KPI Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-[#c2c6d4] shadow-2xs">
                    <div className="text-[11px] font-bold text-[#727782] uppercase tracking-wider">Cámaras</div>
                    <div className="text-[24px] font-bold text-[#071e27] mt-0.5">{activeMetrics.totalCameras}</div>
                    <div className="text-[10px] text-[#727782] mt-1">Total filtrado</div>
                  </div>

                  <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
                    <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span> MT
                    </div>
                    <div className="text-[24px] font-bold text-blue-900 mt-0.5">{activeMetrics.mt}</div>
                    <div className="text-[10px] text-blue-700 mt-1">Media Tensión</div>
                  </div>

                  <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-600"></span> BT
                    </div>
                    <div className="text-[24px] font-bold text-amber-900 mt-0.5">{activeMetrics.bt}</div>
                    <div className="text-[10px] text-amber-700 mt-1">Baja Tensión</div>
                  </div>

                  <div className="bg-cyan-50/70 p-3.5 rounded-xl border border-cyan-200">
                    <div className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-600"></span> DATOS
                    </div>
                    <div className="text-[24px] font-bold text-cyan-900 mt-0.5">{activeMetrics.datos}</div>
                    <div className="text-[10px] text-cyan-700 mt-1">Datos / Control</div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Pendientes</div>
                    <div className="text-[24px] font-bold text-slate-800 mt-0.5">{activeMetrics.pendientes}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Sin iniciar</div>
                  </div>

                  <div className="bg-sky-50 p-3.5 rounded-xl border border-sky-200">
                    <div className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">En Proceso</div>
                    <div className="text-[24px] font-bold text-sky-900 mt-0.5">{activeMetrics.enProceso}</div>
                    <div className="text-[10px] text-sky-600 mt-1">En ejecución</div>
                  </div>

                  <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Terminadas</div>
                    <div className="text-[24px] font-bold text-emerald-900 mt-0.5">{activeMetrics.terminadas}</div>
                    <div className="text-[10px] text-emerald-700 mt-1">Concluidas</div>
                  </div>
                </div>

                {/* 1. Matriz Ejecutiva por Sector (Vista v_matriz_camaras_por_sector) */}
                <div className="bg-white rounded-xl border border-[#c2c6d4] shadow-2xs overflow-hidden">
                  <div className="bg-[#f5f9fc] px-4 py-3 border-b border-[#c2c6d4] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#004d99]">pivot_table_chart</span>
                      <h4 className="font-['Hanken_Grotesk'] font-bold text-[14px] text-[#071e27]">
                        Matriz Ejecutiva por Intersección (Vista SQL: <code className="font-mono text-[12px] text-[#004d99]">v_matriz_camaras_por_sector</code>)
                      </h4>
                    </div>
                    <span className="text-[11px] text-[#727782] font-mono">
                      Columnas agrupadas de Supabase
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px] border-collapse">
                      <thead className="bg-[#f0f4f9] text-[#424752] font-bold border-b border-[#dce2ec]">
                        <tr>
                          <th className="py-2.5 px-3">Sector / Intersección</th>
                          <th className="py-2.5 px-3 text-center">Total</th>
                          <th className="py-2.5 px-3 text-center bg-blue-100/50 text-blue-900">Media Tensión (MT)</th>
                          <th className="py-2.5 px-3 text-center bg-amber-100/50 text-amber-900">Baja Tensión (BT)</th>
                          <th className="py-2.5 px-3 text-center bg-cyan-100/50 text-cyan-900">Datos / Control</th>
                          <th className="py-2.5 px-3 text-center text-slate-700">Pendientes</th>
                          <th className="py-2.5 px-3 text-center text-sky-800">En Proceso</th>
                          <th className="py-2.5 px-3 text-center text-emerald-800">Terminadas</th>
                          <th className="py-2.5 px-3 text-center">Acta 1</th>
                          <th className="py-2.5 px-3 text-center">Acta 2</th>
                          <th className="py-2.5 px-3 text-center">Sin Acta</th>
                          <th className="py-2.5 px-3 text-center">Avance Est.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf0f5]">
                        {cameraSummaryData.matrix.map((row) => (
                          <tr key={row.sectorKey} className="hover:bg-[#fbfdff]">
                            <td className="py-2.5 px-3 font-bold text-[#071e27] flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  row.sectorKey === 'I1'
                                    ? 'bg-blue-600'
                                    : row.sectorKey === 'I2'
                                    ? 'bg-indigo-600'
                                    : row.sectorKey === 'TRONCAL'
                                    ? 'bg-emerald-600'
                                    : 'bg-slate-400'
                                }`}
                              ></span>
                              {row.sectorName}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-[#071e27] bg-[#f8fafc]">
                              {row.total}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-blue-900 bg-blue-50/40">
                              {row.mt}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-900 bg-amber-50/40">
                              {row.bt}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-cyan-900 bg-cyan-50/40">
                              {row.datos}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-700">{row.pendientes}</td>
                            <td className="py-2.5 px-3 text-center text-sky-800 font-bold">{row.enProceso}</td>
                            <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">{row.terminadas}</td>
                            <td className="py-2.5 px-3 text-center text-[#424752]">{row.acta1}</td>
                            <td className="py-2.5 px-3 text-center text-[#424752]">{row.acta2}</td>
                            <td className="py-2.5 px-3 text-center text-slate-400">{row.sinActa}</td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-2 rounded-full"
                                    style={{ width: `${row.porcentajeAvance}%` }}
                                  ></div>
                                </div>
                                <span className="font-bold text-[11px] text-[#071e27]">
                                  {row.porcentajeAvance}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#f0f4f9] font-bold text-[#071e27] border-t-2 border-[#c2c6d4]">
                        <tr>
                          <td className="py-2.5 px-3">Total Consolidado</td>
                          <td className="py-2.5 px-3 text-center font-extrabold text-[#004d99]">
                            {cameraSummaryData.totalCameras}
                          </td>
                          <td className="py-2.5 px-3 text-center text-blue-900 font-extrabold bg-blue-100/60">
                            {cameraSummaryData.global.mt}
                          </td>
                          <td className="py-2.5 px-3 text-center text-amber-900 font-extrabold bg-amber-100/60">
                            {cameraSummaryData.global.bt}
                          </td>
                          <td className="py-2.5 px-3 text-center text-cyan-900 font-extrabold bg-cyan-100/60">
                            {cameraSummaryData.global.datos}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700">{cameraSummaryData.global.pendientes}</td>
                          <td className="py-2.5 px-3 text-center text-sky-800 font-extrabold">{cameraSummaryData.global.enProceso}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-800 font-extrabold">{cameraSummaryData.global.terminadas}</td>
                          <td className="py-2.5 px-3 text-center">
                            {cameraSummaryData.matrix.reduce((acc, r) => acc + r.acta1, 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {cameraSummaryData.matrix.reduce((acc, r) => acc + r.acta2, 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {cameraSummaryData.matrix.reduce((acc, r) => acc + r.sinActa, 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-emerald-800">
                            {cameraSummaryData.totalCameras > 0
                              ? Math.round(
                                  ((cameraSummaryData.global.terminadas + cameraSummaryData.global.enProceso * 0.5) /
                                    cameraSummaryData.totalCameras) *
                                    100
                                )
                              : 0}
                            %
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Resumen de Tramos y Canalizaciones por Intersección */}
                {tramosSummaryData.matrix.length > 0 && (
                  <div className="bg-white p-4 rounded-xl border border-[#c2c6d4] shadow-2xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#004d99]">linear_scale</span>
                        <h4 className="font-['Hanken_Grotesk'] font-bold text-[14px] text-[#071e27]">
                          Tramos de Tubería y Canalizaciones por Sector (Vista SQL: <code className="font-mono text-[12px] text-[#004d99]">v_resumen_tramos_interseccion</code>)
                        </h4>
                      </div>
                      <span className="text-[11px] text-[#727782] font-mono">
                        {tramosSummaryData.totalPipes} Tramos ({tramosSummaryData.totalMetros} m lineales totales)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[12px] border-collapse">
                        <thead className="bg-[#f0f4f9] text-[#424752] font-bold border-b border-[#dce2ec]">
                          <tr>
                            <th className="py-2.5 px-3">Sector / Intersección</th>
                            <th className="py-2.5 px-3 text-center">Tramos Físicos</th>
                            <th className="py-2.5 px-3 text-center">Ductos Totales</th>
                            <th className="py-2.5 px-3 text-center font-bold text-[#004d99]">Metros Totales</th>
                            <th className="py-2.5 px-3 text-center bg-blue-100/50 text-blue-900">Metros MT</th>
                            <th className="py-2.5 px-3 text-center bg-amber-100/50 text-amber-900">Metros BT</th>
                            <th className="py-2.5 px-3 text-center bg-cyan-100/50 text-cyan-900">Metros Datos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf0f5]">
                          {tramosSummaryData.matrix.map((row) => (
                            <tr key={row.sectorKey} className="hover:bg-[#fbfdff]">
                              <td className="py-2.5 px-3 font-bold text-[#071e27] flex items-center gap-2">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    row.sectorKey === 'I1'
                                      ? 'bg-blue-600'
                                      : row.sectorKey === 'I2'
                                      ? 'bg-indigo-600'
                                      : row.sectorKey === 'TRONCAL'
                                      ? 'bg-emerald-600'
                                      : 'bg-slate-400'
                                  }`}
                                ></span>
                                {row.sectorName}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-[#071e27] bg-[#f8fafc]">
                                {row.totalTramos}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-[#424752]">
                                {row.totalDuctos}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-[#004d99]">
                                {row.totalMetros} m
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-blue-900 bg-blue-50/40">
                                {Math.round(row.mtMetros * 100) / 100} m
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-amber-900 bg-amber-50/40">
                                {Math.round(row.btMetros * 100) / 100} m
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-cyan-900 bg-cyan-50/40">
                                {Math.round(row.datosMetros * 100) / 100} m
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#f0f4f9] font-bold text-[#071e27] border-t-2 border-[#c2c6d4]">
                          <tr>
                            <td className="py-2.5 px-3">Total Consolidado</td>
                            <td className="py-2.5 px-3 text-center font-extrabold text-[#004d99]">
                              {tramosSummaryData.totalPipes}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[#424752]">
                              {tramosSummaryData.totalDuctos}
                            </td>
                            <td className="py-2.5 px-3 text-center font-extrabold text-[#004d99]">
                              {tramosSummaryData.totalMetros} m
                            </td>
                            <td className="py-2.5 px-3 text-center text-blue-900 font-extrabold bg-blue-100/60">
                              {Math.round(tramosSummaryData.matrix.reduce((acc, r) => acc + r.mtMetros, 0) * 100) / 100} m
                            </td>
                            <td className="py-2.5 px-3 text-center text-amber-900 font-extrabold bg-amber-100/60">
                              {Math.round(tramosSummaryData.matrix.reduce((acc, r) => acc + r.btMetros, 0) * 100) / 100} m
                            </td>
                            <td className="py-2.5 px-3 text-center text-cyan-900 font-extrabold bg-cyan-100/60">
                              {Math.round(tramosSummaryData.matrix.reduce((acc, r) => acc + r.datosMetros, 0) * 100) / 100} m
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. Desglose Multidimensional (Vista v_resumen_camaras_interseccion) */}
                <div className="bg-white rounded-xl border border-[#c2c6d4] shadow-2xs overflow-hidden">
                  <div className="bg-[#f5f9fc] px-4 py-3 border-b border-[#c2c6d4] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#004d99]">view_list</span>
                      <h4 className="font-['Hanken_Grotesk'] font-bold text-[14px] text-[#071e27]">
                        Desglose Multidimensional por Fecha, Acta y Estado (Vista SQL: <code className="font-mono text-[12px] text-[#004d99]">v_resumen_camaras_interseccion</code>)
                      </h4>
                    </div>
                    <span className="text-[11px] text-[#727782]">
                      Mostrando {filteredDetails.length} agrupaciones
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left text-[12px] border-collapse">
                      <thead className="bg-[#f0f4f9] text-[#424752] font-bold border-b border-[#dce2ec] sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Sector</th>
                          <th className="py-2.5 px-3">Tipo de Red</th>
                          <th className="py-2.5 px-3">Estado de Ejecución</th>
                          <th className="py-2.5 px-3">Acta Contractual</th>
                          <th className="py-2.5 px-3">Fecha de Inspección</th>
                          <th className="py-2.5 px-3 text-center">Cantidad Cámaras</th>
                          <th className="py-2.5 px-3 text-center">Con Fotos</th>
                          <th className="py-2.5 px-3">Muestra de Elementos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf0f5]">
                        {filteredDetails.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-[#727782]">
                              No se encontraron registros con los filtros seleccionados.
                            </td>
                          </tr>
                        ) : (
                          filteredDetails.map((row) => (
                            <tr key={row.key} className="hover:bg-[#fbfdff]">
                              <td className="py-2 px-3 font-semibold text-[#071e27] whitespace-nowrap">
                                {row.sectorName}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    row.net === 'MT'
                                      ? 'bg-blue-100 text-blue-900'
                                      : row.net === 'BT'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-cyan-100 text-cyan-900'
                                  }`}
                                >
                                  {row.net} ({row.netLabel})
                                </span>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    row.status === 'Terminado'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : row.status === 'En proceso'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-[#424752] whitespace-nowrap">
                                {row.acta}
                              </td>
                              <td className="py-2 px-3 text-[#727782] font-mono text-[11px] whitespace-nowrap">
                                {row.date}
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-[#071e27]">
                                <span className="px-2 py-0.5 bg-[#eef3f9] rounded-md font-mono text-[12px]">
                                  {row.count}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center text-[11px] font-mono">
                                {row.conFotos > 0 ? (
                                  <span className="text-emerald-700 font-bold">{row.conFotos}</span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[#424752] font-mono text-[11px] truncate max-w-xs">
                                {row.elements.join(', ')}
                                {row.count > row.elements.length ? ` y ${row.count - row.elements.length} más` : ''}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SQL Quick Copy Card */}
                <div className="p-4 bg-slate-900 text-slate-200 rounded-xl border border-slate-700 font-mono text-[12px] space-y-2">
                  <div className="flex items-center justify-between text-slate-300 font-sans text-[12px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-blue-400">code</span>
                      Consultas SQL listas para ejecutar en Supabase:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const sqlText = `-- Resumen por Intersección 1:\nSELECT * FROM v_resumen_camaras_interseccion WHERE sector = 'Intersección 1';\n\n-- Matriz Ejecutiva completa:\nSELECT * FROM v_matriz_camaras_por_sector;`;
                        navigator.clipboard.writeText(sqlText);
                        onShowToast('Consultas SQL copiadas al portapapeles', 'success');
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded text-[11px] font-bold transition-colors"
                    >
                      Copiar Consultas
                    </button>
                  </div>
                  <pre className="text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
{`-- 1. Ver matriz ejecutiva de cámaras por sector, MT, BT, Datos y avance:
SELECT * FROM v_matriz_camaras_por_sector;

-- 2. Ver desglose detallado de la Intersección 1 por red, fecha, acta y estado:
SELECT * FROM v_resumen_camaras_interseccion WHERE sector = 'Intersección 1';

-- 3. Ver inventario normalizado sin mezclar ductos ni cables:
SELECT * FROM v_camaras_inventario WHERE sector_codigo = 'I1' AND tipo_red = 'MT';`}
                  </pre>
                </div>
              </div>
            );
          })()}

          {/* TAB 1: DIAGNÓSTICO & ARQUITECTURA ANTI-FLAT */}
          {activeTab === 'diagnostico' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-blue-950 text-white shadow-md space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                    Diagnóstico de Base de Datos
                  </span>
                  <span className="text-[12px] text-slate-300">
                    Supabase PostgreSQL Architecture
                  </span>
                </div>
                <h3 className="text-[18px] font-['Hanken_Grotesk'] font-bold leading-snug">
                  Diagnóstico: Tablas a Omitir y Cómo Desacoplar el Antipatrón "Flat Table"
                </h3>
                <p className="text-[12px] text-slate-300 max-w-3xl leading-relaxed">
                  Respuesta técnica a cómo organizar la base de datos de Supabase sin romper la aplicación, qué tablas se pueden omitir con seguridad y cómo visualizar la información agrupada por Intersección, Red (MT, BT, Datos), Acta y Estado.
                </p>
              </div>

              {/* SECTION 1: TABLAS A OMITIR */}
              <div className="bg-white p-5 rounded-xl border border-[#c2c6d4] shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-[#071e27] border-b border-slate-200 pb-3">
                  <span className="material-symbols-outlined text-[22px] text-rose-600">remove_circle</span>
                  <div>
                    <h4 className="font-['Hanken_Grotesk'] font-bold text-[15px] text-[#071e27]">
                      1. Diagnóstico de Tablas que Podemos Omitir en Supabase
                    </h4>
                    <p className="text-[12px] text-[#727782]">
                      Tablas que no agregan valor en la nube y aumentan la complejidad innecesariamente
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Item 1: sync_offline_queue */}
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono font-bold text-[13px] text-rose-900">
                        <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                        sync_offline_queue
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        RECOMENDADO OMITIR
                      </span>
                    </div>
                    <p className="text-[12px] text-[#334155] leading-relaxed">
                      <strong>Por qué omitir en Supabase:</strong> La cola de sincronización offline es un patrón de almacenamiento exclusivo del <em>cliente</em> (en el navegador o tablet del inspector con IndexedDB o SQLite local). Si se sube a Supabase, se duplican registros en estado intermedio y se generan tablas "basura" en la nube con transacciones no resueltas.
                    </p>
                    <div className="text-[11px] font-semibold text-rose-700 bg-rose-100/50 p-2 rounded-lg">
                      💡 Solución: Mantener la cola localmente en la app y enviar directamente a <code className="font-mono">inspection_photos</code> una vez recuperada la conexión.
                    </div>
                  </div>

                  {/* Item 2: blueprint_calibration */}
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono font-bold text-[13px] text-amber-900">
                        <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                        blueprint_calibration
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        OMITIR TABLA SEPARADA
                      </span>
                    </div>
                    <p className="text-[12px] text-[#334155] leading-relaxed">
                      <strong>Por qué omitir en Supabase:</strong> La calibración (escala píxeles a metros, punto de origen X/Y) tiene una relación estricta 1 a 1 con cada plano arquitectónico. Crear una tabla separada obliga a hacer un <code className="font-mono text-[11px]">JOIN</code> cada vez que se carga un plano.
                    </p>
                    <div className="text-[11px] font-semibold text-amber-800 bg-amber-100/50 p-2 rounded-lg">
                      💡 Solución: Incrustar los metadatos de calibración como columna <code className="font-mono">calibration JSONB</code> dentro de la tabla <code className="font-mono">blueprints</code>.
                    </div>
                  </div>

                  {/* Item 3: app_configurations / app_settings */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono font-bold text-[13px] text-slate-800">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                        app_configurations / app_settings
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        OPCIONAL / OMITIR
                      </span>
                    </div>
                    <p className="text-[12px] text-[#334155] leading-relaxed">
                      <strong>Por qué omitir en Supabase:</strong> Parámetros de interfaz como alertas por vibración, tema visual o calidad de compresión de foto en móvil son preferencias del cliente, no entidades de la infraestructura civil ni eléctrica.
                    </p>
                    <div className="text-[11px] font-semibold text-slate-700 bg-slate-200/50 p-2 rounded-lg">
                      💡 Solución: Guardar en <code className="font-mono">localStorage</code> del dispositivo del inspector.
                    </div>
                  </div>

                  {/* Item 4: inspection_collections */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono font-bold text-[13px] text-slate-800">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                        inspection_collections
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        PRESCINDIBLE
                      </span>
                    </div>
                    <p className="text-[12px] text-[#334155] leading-relaxed">
                      <strong>Por qué omitir en Supabase:</strong> En la obra real de este proyecto, los ejes naturales de organización y cobro son contractuales: <strong>Sector (Intersección 1, 2, Troncal)</strong>, <strong>Tipo de Red (MT, BT, Datos)</strong> y <strong>Actas (Acta 1, 2, 3)</strong>. Crear colecciones arbitrarias confunde al equipo.
                    </p>
                    <div className="text-[11px] font-semibold text-slate-700 bg-slate-200/50 p-2 rounded-lg">
                      💡 Solución: Usar las vistas por Sector y Acta para organizar el proyecto.
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: EL PROBLEMA DEL FLAT TABLE */}
              <div className="bg-white p-5 rounded-xl border border-[#c2c6d4] shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-[#071e27] border-b border-slate-200 pb-3">
                  <span className="material-symbols-outlined text-[22px] text-amber-600">warning</span>
                  <div>
                    <h4 className="font-['Hanken_Grotesk'] font-bold text-[15px] text-[#071e27]">
                      2. Diagnóstico del Antipatrón "Flat Table" en <code className="font-mono text-[#004d99]">inspection_photos</code>
                    </h4>
                    <p className="text-[12px] text-[#727782]">
                      Por qué una sola tabla plana de 30+ columnas dificulta ver y resumir la información
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12px]">
                  <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1.5">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">device_hub</span>
                      Mezcla de Entidades
                    </div>
                    <p className="text-[#334155] leading-relaxed">
                      En <code className="font-mono text-[11px]">inspection_photos</code> conviven elementos físicos de naturaleza totalmente distinta: <strong>cámaras</strong> (elementos puntuales con código SB850) y <strong>tramos/zanjas</strong> (elementos lineales continuos con metraje y múltiples ductos).
                    </p>
                  </div>

                  <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1.5">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">data_object</span>
                      Ductos Ocultos en JSONB
                    </div>
                    <p className="text-[#334155] leading-relaxed">
                      Los ductos de Datos y Media Tensión están empaquetados en un array <code className="font-mono text-[11px]">pipe_conduits</code>. En el Table Editor de Supabase, esto se ve como texto plano, impidiendo hacer filtros sencillos como "ver sólo ductos de Datos de 3x4 pulgadas".
                    </p>
                  </div>

                  <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1.5">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">label</span>
                      Sector Embebido en Nombre
                    </div>
                    <p className="text-[#334155] leading-relaxed">
                      El sector al que pertenece la cámara no era una columna real, sino texto dentro del nombre (ej: <code className="font-mono text-[11px]">C8_BT_I1</code> o <code className="font-mono text-[11px]">C50A_BT_I2</code>), requiriendo expresiones regulares para saber si es Intersección 1 o 2.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 3: SOLUCIÓN IMPLEMENTADA (VISTAS SQL) */}
              <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px] text-blue-700">task_alt</span>
                    <div>
                      <h4 className="font-['Hanken_Grotesk'] font-bold text-[15px] text-[#003366]">
                        3. Solución Implementada: Vistas Relacionales (Zero-Risk, Sin Romper la App)
                      </h4>
                      <p className="text-[12px] text-[#334e68]">
                        Desacopla la tabla plana inmediatamente creando interfaces normalizadas en PostgreSQL
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                    Activa en este proyecto
                  </span>
                </div>

                <p className="text-[13px] text-[#334155] leading-relaxed">
                  Para resolver tu requerimiento sin tener que reescribir toda la lógica de captura del frontend, creamos <strong>Vistas SQL en Supabase</strong>. La aplicación sigue escribiendo rápido y seguro en <code className="font-mono text-[12px]">inspection_photos</code>, mientras que para ti, Supabase expone <strong>4 tablas virtuales perfectamente normalizadas</strong>:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                    <div className="font-mono font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">analytics</span>
                      v_resumen_camaras_interseccion
                    </div>
                    <p className="text-[#334155]">
                      Agrupa por Sector (I1, I2, Troncal), Tipo de Red (MT, BT, Datos), Fecha, Acta y Estado para responder exactamente tu pregunta inicial.
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                    <div className="font-mono font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">pivot_table_chart</span>
                      v_matriz_camaras_por_sector
                    </div>
                    <p className="text-[#334155]">
                      Genera la matriz gerencial de avance con columnas directas para MT, BT, Datos, pendientes, en proceso, terminadas y porcentaje.
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                    <div className="font-mono font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">videocam</span>
                      v_camaras_inventario
                    </div>
                    <p className="text-[#334155]">
                      Inventario limpio de cámaras físicas con sector, red, acta y fotos sin mezclar tuberías ni cables.
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                    <div className="font-mono font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">alt_route</span>
                      v_tramos_conduits
                    </div>
                    <p className="text-[#334155]">
                      Desempaqueta cada ducto individual de Datos y Media Tensión en una fila propia con su longitud en metros.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 4: MODELO RELACIONAL NORMALIZADO (3NF) PROPUESTO */}
              <div className="bg-white p-5 rounded-xl border border-[#c2c6d4] shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-[#071e27] border-b border-slate-200 pb-3">
                  <span className="material-symbols-outlined text-[22px] text-emerald-600">account_tree</span>
                  <div>
                    <h4 className="font-['Hanken_Grotesk'] font-bold text-[15px] text-[#071e27]">
                      4. Propuesta de Arquitectura Relacional Normalizada (3NF) para el Futuro
                    </h4>
                    <p className="text-[12px] text-[#727782]">
                      Si deseas migrar a una estructura 100% relacional sin JSONB, estas son las 6 tablas maestras ideales:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[12px]">
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-mono font-bold text-[#004d99]">1. sectores</div>
                    <div className="text-[11px] text-[#727782]">id, codigo ('I1', 'I2', 'TRONCAL'), nombre, descripcion</div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-mono font-bold text-[#004d99]">2. redes</div>
                    <div className="text-[11px] text-[#727782]">id, codigo ('MT', 'BT', 'DATOS'), nombre, color_hex</div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-mono font-bold text-[#004d99]">3. elementos_obra</div>
                    <div className="text-[11px] text-[#727782]">id, sector_id, tipo ('camara' | 'tramo'), codigo, blueprint_id, x, y</div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-mono font-bold text-[#004d99]">4. ductos_canalizacion</div>
                    <div className="text-[11px] text-[#727782]">id, elemento_id, red_id, diametro_pulgadas, longitud_metros</div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-mono font-bold text-[#004d99]">5. inspecciones_registro</div>
                    <div className="text-[11px] text-[#727782]">id, elemento_id, inspector_id, fecha, acta, estado, observaciones</div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-mono font-bold text-[#004d99]">6. fotos_evidencia</div>
                    <div className="text-[11px] text-[#727782]">id, inspeccion_id, storage_url, created_at</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TABLES EXPLORER */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              {/* Informative banner on Media Tensión and Datos tramos */}
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-[13px] text-[#071e27] flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-[#004d99] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[18px]">alt_route</span>
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-[#004d99] flex items-center gap-2">
                    Estructura de Tramos de Media Tensión y Datos en Supabase
                  </div>
                  <p className="text-[#334155] leading-relaxed">
                    Tanto los tramos de <strong>Media Tensión (MT)</strong> como los de <strong>Datos / Control</strong> y <strong>Baja Tensión (BT)</strong> están almacenados y sincronizados en la tabla principal <code className="px-1.5 py-0.5 bg-white rounded border border-blue-200 font-mono text-[11px]">inspection_photos</code>. Cada tramo físico almacena sus ductos por red en el campo <code className="px-1.5 py-0.5 bg-white rounded border border-blue-200 font-mono text-[11px]">pipe_conduits</code> (JSONB).
                  </p>
                  <p className="text-[#334155] leading-relaxed">
                    Para visualizar o exportar los ductos de <strong>Datos</strong> y <strong>Media Tensión</strong> de manera individual o desagregada en Supabase, ejecuta las vistas creadas <code className="px-1.5 py-0.5 bg-white rounded border border-blue-200 font-mono text-[11px]">v_tramos_conduits</code> y <code className="px-1.5 py-0.5 bg-white rounded border border-blue-200 font-mono text-[11px]">v_tramos_datos</code> disponibles en la pestaña <strong>Script SQL</strong>.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Table List */}
              <div className="md:col-span-4 space-y-2">
                <div className="font-['Inter'] font-bold text-[12px] uppercase tracking-wider text-[#727782] px-1 mb-1">
                  Tablas del Sistema
                </div>
                {Object.entries(tablesData).map(([key, table]) => {
                  const isSelected = selectedTable === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedTable(key)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'bg-[#e7f2ff] border-[#004d99] shadow-xs'
                          : 'bg-white border-[#c2c6d4] hover:bg-[#f3faff]'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#004d99] text-white' : 'bg-[#e0e3eb] text-[#424752]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{table.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[13px] font-bold text-[#071e27] truncate">
                          {table.name}
                        </div>
                        <div className="text-[11px] text-[#424752] line-clamp-1">
                          {table.columns.length} columnas
                        </div>
                      </div>
                    </button>
                  );
                })}

                <div className="mt-4 p-3.5 bg-[#f0f4f9] rounded-xl border border-[#dce2ec] text-[12px] text-[#424752] space-y-2">
                  <div className="font-bold text-[#071e27] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#004d99]">info</span>
                    ¿Cómo aplicar estas tablas?
                  </div>
                  <p>
                    Puedes copiar el script SQL completo en la pestaña <strong>"Script SQL"</strong> y pegarlo directamente en el <em>SQL Editor</em> de Supabase.
                  </p>
                </div>
              </div>

              {/* Right Column: Selected Table Schema */}
              <div className="md:col-span-8 space-y-4">
                {tablesData[selectedTable] && (
                  <div className="bg-white rounded-xl border border-[#c2c6d4] overflow-hidden shadow-2xs">
                    <div className="bg-[#f5f7f8] p-4 border-b border-[#c2c6d4] flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[15px] text-[#004d99]">
                            public.{tablesData[selectedTable].name}
                          </span>
                          <span className="px-2 py-0.5 bg-[#dbeafe] text-[#1e40af] text-[11px] font-bold rounded">
                            {tablesData[selectedTable].columns.length} campos
                          </span>
                        </div>
                        <p className="text-[12px] text-[#424752] mt-0.5">
                          {tablesData[selectedTable].description}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[12px] font-['Inter']">
                        <thead className="bg-[#f0f4f8] text-[#424752] font-bold border-b border-[#c2c6d4]">
                          <tr>
                            <th className="px-3.5 py-2.5">Columna</th>
                            <th className="px-3.5 py-2.5">Tipo</th>
                            <th className="px-3.5 py-2.5">Restricción</th>
                            <th className="px-3.5 py-2.5">Descripción de Campo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e3e7ee]">
                          {tablesData[selectedTable].columns.map((col, idx) => (
                            <tr key={idx} className="hover:bg-[#f9fafb]">
                              <td className="px-3.5 py-2 font-mono font-bold text-[#071e27]">
                                {col.name}
                              </td>
                              <td className="px-3.5 py-2 font-mono text-[#004d99] font-medium">
                                {col.type}
                              </td>
                              <td className="px-3.5 py-2 text-[#64748b] text-[11px]">
                                {col.constraints}
                              </td>
                              <td className="px-3.5 py-2 text-[#424752]">
                                {col.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

          {/* TAB 2: SQL SCRIPT & RUN INSTRUCTIONS */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#eef7ff] p-4 rounded-xl border border-[#b8daff]">
                <div>
                  <h3 className="font-['Hanken_Grotesk'] font-bold text-[15px] text-[#003366]">
                    Script SQL para Crear Tablas y Políticas de Seguridad
                  </h3>
                  <p className="text-[12px] text-[#334e68]">
                    Ejecuta este código en el <strong>SQL Editor de Supabase</strong> para habilitar todas las tablas e índices automáticamente.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-4 py-2 bg-[#004d99] hover:bg-[#003870] text-white font-bold text-[13px] rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {copiedSql ? 'check' : 'content_copy'}
                    </span>
                    {copiedSql ? '¡Copiado!' : 'Copiar SQL'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSql}
                    className="px-3.5 py-2 bg-white hover:bg-[#f0f4f9] border border-[#c2c6d4] text-[#071e27] font-bold text-[13px] rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Descargar .sql
                  </button>
                </div>
              </div>

              {/* Instructions steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                <div className="p-3 bg-white border border-[#c2c6d4] rounded-xl flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#004d99] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-[#071e27]">Abre Supabase</div>
                    <div className="text-[#424752]">Entra a tu proyecto en supabase.com y ve al menú <strong>SQL Editor</strong>.</div>
                  </div>
                </div>

                <div className="p-3 bg-white border border-[#c2c6d4] rounded-xl flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#004d99] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-[#071e27]">Pega el Script</div>
                    <div className="text-[#424752]">Crea una nueva consulta (New Query) y pega el código de abajo.</div>
                  </div>
                </div>

                <div className="p-3 bg-white border border-[#c2c6d4] rounded-xl flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#004d99] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-[#071e27]">Haz clic en Run</div>
                    <div className="text-[#424752]">Presiona el botón verde <strong>Run</strong> para crear las tablas y políticas.</div>
                  </div>
                </div>
              </div>

              {/* SQL Code block */}
              <div className="relative rounded-xl border border-[#2d3748] bg-[#0f172a] text-[#e2e8f0] font-mono text-[12px] p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {supabaseService.getSupabaseSchemaSql()}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: DATA SYNC */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-xl border border-[#c2c6d4] shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                  <div>
                    <h3 className="font-['Hanken_Grotesk'] font-bold text-base text-[#071e27]">
                      Sincronización Bidireccional con Supabase
                    </h3>
                    <p className="text-[13px] text-[#424752]">
                      Transfiere los registros fotográficos, códigos de cámara (SB850/851/858), notas y perfiles entre el inspector y la nube.
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-[#f0f4f9] rounded-lg border border-[#c2c6d4] text-[13px] font-bold text-[#004d99]">
                    {photos.length} Fotos Locales
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Push to Supabase */}
                  <div className="p-4 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-[14px] text-[#0f172a]">
                        <span className="material-symbols-outlined text-[#004d99]">cloud_upload</span>
                        Subir Todo a Supabase
                      </div>
                      <p className="text-[12px] text-[#475569] mt-1">
                        Sube o actualiza en bloque las {photos.length} fotos de inspección y los datos del inspector en la tabla <code className="text-[#004d99]">inspection_photos</code>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncAllToSupabase}
                      disabled={isSyncing || photos.length === 0}
                      className="w-full py-2.5 px-4 bg-[#004d99] hover:bg-[#003870] disabled:bg-[#94a3b8] text-white font-bold text-[13px] rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isSyncing ? 'refresh' : 'sync'}
                      </span>
                      {isSyncing ? 'Sincronizando...' : 'Sincronizar a Supabase'}
                    </button>
                  </div>

                  {/* Pull from Supabase */}
                  <div className="p-4 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-[14px] text-[#0f172a]">
                        <span className="material-symbols-outlined text-[#0284c7]">cloud_download</span>
                        Importar desde Supabase
                      </div>
                      <p className="text-[12px] text-[#475569] mt-1">
                        Consulta y descarga los registros de inspección existentes en la base de datos de Supabase para visualizarlos en la galería.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleImportFromSupabase}
                      disabled={isImporting}
                      className="w-full py-2.5 px-4 bg-[#0284c7] hover:bg-[#0369a1] disabled:bg-[#94a3b8] text-white font-bold text-[13px] rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isImporting ? 'refresh' : 'download'}
                      </span>
                      {isImporting ? 'Importando...' : 'Descargar de Supabase'}
                    </button>
                  </div>
                </div>

                {/* Sector Update Card */}
                <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/70 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#004d99] text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">share_location</span>
                      </div>
                      <div>
                        <div className="font-bold text-[14px] text-[#071e27]">
                          Actualizar Sector de Todos los Elementos en Supabase
                        </div>
                        <div className="text-[12px] text-[#424752]">
                          Aplica la regla en las tablas <code className="font-bold text-[#004d99]">inspection_photos</code> e <code className="font-bold text-[#004d99]">inspection_activities</code>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const sqlScript = `-- 1. AGREGAR COLUMNAS EN inspection_photos (Tabla principal de fotos y tramos)
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE public.inspection_photos ADD COLUMN IF NOT EXISTS sector_code TEXT;

-- 2. ACTUALIZAR SECTOR EN TODOS LOS ELEMENTOS
UPDATE public.inspection_photos
SET
  sector_code = CASE
    WHEN UPPER(name) LIKE '%I1%' THEN 'I1'
    WHEN UPPER(name) LIKE '%I2%' THEN 'I2'
    WHEN UPPER(name) LIKE '%TRONCAL%' THEN 'TRONCAL'
    ELSE 'OTRO'
  END,
  sector = CASE
    WHEN UPPER(name) LIKE '%I1%' THEN 'Intersección 1'
    WHEN UPPER(name) LIKE '%I2%' THEN 'Intersección 2'
    WHEN UPPER(name) LIKE '%TRONCAL%' THEN 'Troncal Principal'
    ELSE 'Otros Sectores'
  END;

-- 3. ACTUALIZAR EN inspection_activities SOLO SI LA TABLA EXISTE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inspection_activities'
  ) THEN
    ALTER TABLE public.inspection_activities ADD COLUMN IF NOT EXISTS sector TEXT;
    ALTER TABLE public.inspection_activities ADD COLUMN IF NOT EXISTS sector_code TEXT;

    UPDATE public.inspection_activities
    SET
      sector_code = CASE
        WHEN UPPER(photo_name) LIKE '%I1%' THEN 'I1'
        WHEN UPPER(photo_name) LIKE '%I2%' THEN 'I2'
        WHEN UPPER(photo_name) LIKE '%TRONCAL%' THEN 'TRONCAL'
        ELSE 'OTRO'
      END,
      sector = CASE
        WHEN UPPER(photo_name) LIKE '%I1%' THEN 'Intersección 1'
        WHEN UPPER(photo_name) LIKE '%I2%' THEN 'Intersección 2'
        WHEN UPPER(photo_name) LIKE '%TRONCAL%' THEN 'Troncal Principal'
        ELSE 'Otros Sectores'
      END;
  END IF;
END $$;`;
                          navigator.clipboard.writeText(sqlScript);
                          setCopiedSectorSql(true);
                          setTimeout(() => setCopiedSectorSql(false), 2500);
                          onShowToast('¡SQL de sectores copiado al portapapeles!', 'success');
                        }}
                        className="px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedSectorSql ? 'check' : 'content_copy'}
                        </span>
                        <span>{copiedSectorSql ? 'Copiado' : 'Copiar SQL'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleUpdateSectors}
                        disabled={isUpdatingSectors}
                        className="px-4 py-2 bg-gradient-to-r from-[#004d99] to-[#1565c0] hover:from-[#003870] hover:to-[#0d47a1] disabled:bg-slate-400 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isUpdatingSectors ? 'refresh' : 'published_with_changes'}
                        </span>
                        <span>{isUpdatingSectors ? 'Actualizando sectores...' : 'Ejecutar en Supabase'}</span>
                      </button>
                    </div>
                  </div>
                  {/* Reglas visuales */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-200/60 text-xs">
                      <span className="font-bold text-blue-900 block">Nombre contiene I1</span>
                      <span className="text-blue-700 text-[11px]">Intersección 1 (I1)</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-purple-200/60 text-xs">
                      <span className="font-bold text-purple-900 block">Nombre contiene I2</span>
                      <span className="text-purple-700 text-[11px]">Intersección 2 (I2)</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60 text-xs">
                      <span className="font-bold text-amber-900 block">Nombre contiene TRONCAL</span>
                      <span className="text-amber-700 text-[11px]">Troncal Principal (TRONCAL)</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60 text-xs">
                      <span className="font-bold text-slate-900 block">Demás casos</span>
                      <span className="text-slate-600 text-[11px]">Otros Sectores (OTRO)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Box */}
              {connectionStatus && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    connectionStatus.connected
                      ? 'bg-[#f0fdf4] border-[#86efac] text-[#166534]'
                      : 'bg-[#fff1f2] border-[#fecdd3] text-[#9f1239]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] shrink-0">
                    {connectionStatus.connected ? 'check_circle' : 'error'}
                  </span>
                  <div className="text-[13px]">
                    <div className="font-bold">
                      {connectionStatus.connected ? 'Estado del Servidor' : 'Aviso de Conexión'}
                    </div>
                    <div className="mt-0.5">{connectionStatus.message}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CONNECTION & CREDENTIALS */}
          {activeTab === 'connection' && (
            <div className="space-y-5">
              <div className="bg-white p-5 rounded-xl border border-[#c2c6d4] shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                  <div>
                    <h3 className="font-['Hanken_Grotesk'] font-bold text-base text-[#071e27]">
                      Configuración de Credenciales de Supabase
                    </h3>
                    <p className="text-[13px] text-[#424752]">
                      Las variables pueden configurarse en <code className="text-[#004d99]">.env</code> o directamente aquí para acceso inmediato.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-3.5 py-1.5 bg-[#f0f4f9] hover:bg-[#e2e8f0] border border-[#c2c6d4] text-[#004d99] font-bold text-[12px] rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isTesting ? 'refresh' : 'wifi_tethering'}
                    </span>
                    {isTesting ? 'Comprobando...' : 'Comprobar Estado'}
                  </button>
                </div>

                <form onSubmit={handleSaveCredentials} className="space-y-4">
                  <div>
                    <label className="block font-['Inter'] font-bold text-[13px] text-[#071e27] mb-1">
                      Supabase Project URL (VITE_SUPABASE_URL)
                    </label>
                    <input
                      type="text"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="https://tu-proyecto.supabase.co"
                      className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-lg p-2.5 text-[13px] font-mono text-[#071e27] focus:ring-2 focus:ring-[#004d99] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-['Inter'] font-bold text-[13px] text-[#071e27] mb-1">
                      Supabase Public Anon Key (VITE_SUPABASE_ANON_KEY)
                    </label>
                    <input
                      type="password"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-lg p-2.5 text-[13px] font-mono text-[#071e27] focus:ring-2 focus:ring-[#004d99] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleResetCredentials}
                      className="text-[12px] text-[#64748b] hover:text-[#004d99] underline"
                    >
                      Restablecer a valores de entorno
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#004d99] text-white font-bold text-[13px] rounded-lg hover:bg-[#003870] transition-colors shadow-xs"
                      >
                        Guardar y Conectar
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Status Diagnostic Card */}
              {connectionStatus && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    connectionStatus.connected
                      ? 'bg-[#f0fdf4] border-[#86efac] text-[#166534]'
                      : 'bg-[#fff1f2] border-[#fecdd3] text-[#9f1239]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px] shrink-0">
                    {connectionStatus.connected ? 'task_alt' : 'cancel'}
                  </span>
                  <div className="text-[13px] space-y-1">
                    <div className="font-bold text-[14px]">
                      {connectionStatus.connected
                        ? 'Servicio de Supabase Conectado'
                        : 'No Conectado'}
                    </div>
                    <div>{connectionStatus.message}</div>
                    {connectionStatus.missingTables && connectionStatus.missingTables.length > 0 && (
                      <div className="mt-2 text-[12px] bg-white/70 p-2 rounded-lg border border-current">
                        <strong>Tablas pendientes por crear en Supabase:</strong>{' '}
                        {connectionStatus.missingTables.join(', ')}.
                        <div className="mt-1">
                          Ve a la pestaña <strong>"Script SQL para Supabase"</strong> y ejecuta el código en el SQL Editor.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f0f4f8] px-5 py-3 border-t border-[#c2c6d4] flex items-center justify-between">
          <div className="text-[12px] text-[#424752] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            PostgreSQL &bull; 5 Tablas estructuradas para el inspector
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#004d99] hover:bg-[#003870] text-white font-bold text-[13px] rounded-lg transition-colors"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
