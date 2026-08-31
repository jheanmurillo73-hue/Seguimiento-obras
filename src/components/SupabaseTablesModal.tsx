import React, { useState, useEffect } from 'react';
import { supabaseService, SupabaseConnectionStatus } from '../services/supabaseService';
import { getActiveSupabaseConfig, saveCustomSupabaseConfig, resetSupabaseConfig } from '../lib/supabase';
import { InspectionPhoto, InspectorProfile } from '../types';

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
  const [activeTab, setActiveTab] = useState<'tables' | 'sql' | 'connection' | 'sync'>('tables');
  const [selectedTable, setSelectedTable] = useState<string>('inspection_photos');
  const [copiedSql, setCopiedSql] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  if (!isOpen) return null;

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
  };

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
            onClick={() => setActiveTab('tables')}
            className={`py-3 px-3.5 border-b-2 font-['Inter'] text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'tables'
                ? 'border-[#004d99] text-[#004d99]'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            Estructura de Tablas ({Object.keys(tablesData).length})
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
            Sincronización de Datos ({photos.length} fotos)
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
          {/* TAB 1: TABLES EXPLORER */}
          {activeTab === 'tables' && (
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
