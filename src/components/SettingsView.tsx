import React, { useState, useRef } from 'react';
import { AppSettings, InspectorProfile, InspectionPhoto, ActivityItem } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { getDeviceStorageStats, exportLocalBackup, importLocalBackup } from '../services/deviceStorageService';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  inspector: InspectorProfile;
  onOpenProfile: () => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onOpenSupabaseModal?: () => void;
  photos?: InspectionPhoto[];
  activities?: ActivityItem[];
  onRestoreBackup?: (backupData: {
    photos?: InspectionPhoto[];
    inspector?: InspectorProfile;
    settings?: AppSettings;
    activities?: ActivityItem[];
  }) => void;
  canResetOperationalData?: boolean;
  onResetOperationalData?: () => Promise<void>;
  canManageActaAssignment?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  inspector,
  onOpenProfile,
  onShowToast,
  onOpenSupabaseModal,
  photos = [],
  activities = [],
  onRestoreBackup,
  canResetOperationalData = false,
  onResetOperationalData,
  canManageActaAssignment = false,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(true);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetPhrase, setResetPhrase] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetFeedback, setResetFeedback] = useState<{
    type: 'loading' | 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSupabase = isSupabaseConfigured();
  const storageStats = getDeviceStorageStats(photos, activities);

  const handleToggle = (key: keyof AppSettings) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDiscard = () => {
    setLocalSettings({ ...settings });
    onShowToast('Modificaciones descartadas.', 'info');
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    onShowToast('¡Preferencias guardadas exitosamente!', 'success');
  };

  const handleExport = () => {
    exportLocalBackup({
      photos,
      inspector,
      settings: localSettings,
      activities,
    });
    onShowToast('Copia de seguridad descargada exitosamente en este dispositivo.', 'success');
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const backupData = await importLocalBackup(file);
      if (onRestoreBackup) {
        onRestoreBackup(backupData);
      }
      onShowToast('Copia de seguridad restaurada correctamente.', 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Error al importar archivo de respaldo.', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSecuritySave = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSecurityModal(false);
    onShowToast('Credenciales de seguridad actualizadas.', 'success');
    setCurrentPassword('');
    setNewPassword('');
  };

  const handleOperationalReset = async () => {
    if (!onResetOperationalData || resetPhrase.trim().toUpperCase() !== 'RESTABLECER') return;
    setIsResetting(true);
    setResetFeedback({ type: 'loading', message: 'Estamos eliminando los datos operativos y limpiando la memoria local. No cierres esta ventana.' });
    try {
      await onResetOperationalData();
      setResetPhrase('');
      const message = 'Restablecimiento completado. Los datos operativos fueron eliminados y los perfiles, roles y permisos se conservaron.';
      setResetFeedback({ type: 'success', message });
      onShowToast(message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar el restablecimiento.';
      setResetFeedback({ type: 'error', message });
      onShowToast(message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Hanken_Grotesk'] text-2xl sm:text-[32px] font-bold text-[#071e27] leading-tight">
            Configuración del Sistema
          </h1>
          <p className="font-['Inter'] text-[14px] text-[#424752] mt-1">
            Gestión de memoria local en tu dispositivo (PC / Celular), respaldos y preferencias de inspección.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 bg-[#1b6d24] hover:bg-[#155d1e] text-white font-['Inter'] font-bold text-[13px] rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            title="Guardar archivo de respaldo en tu PC o celular"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Exportar Respaldo
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Device Local Memory & Storage Card */}
        <section className="bg-white border-2 border-[#004d99]/40 rounded-xl overflow-hidden shadow-xs">
          <div className="bg-[#004d99] text-white px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-white text-[22px]">memory</span>
              <div>
                <h2 className="font-['Hanken_Grotesk'] font-bold text-base">
                  Almacenamiento en Memoria del Dispositivo (PC / Celular)
                </h2>
                <div className="text-[12px] text-white/80 font-normal">
                  Tus fotos, etiquetas y notas se almacenan directamente en este equipo sin requerir internet.
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Modo Local Activo
            </span>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Storage Metric Gauges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#f3faff] border border-[#c2c6d4]">
                <div className="text-[12px] font-bold text-[#727783] uppercase tracking-wider">
                  Espacio Ocupado
                </div>
                <div className="font-['Hanken_Grotesk'] text-2xl font-bold text-[#004d99] mt-1">
                  {storageStats.usedFormatted}
                </div>
                <div className="text-[11px] text-[#424752] mt-0.5">
                  Fotos, perfiles y bitácoras locales
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#f3faff] border border-[#c2c6d4]">
                <div className="text-[12px] font-bold text-[#727783] uppercase tracking-wider">
                  Inspecciones Guardadas
                </div>
                <div className="font-['Hanken_Grotesk'] text-2xl font-bold text-[#071e27] mt-1">
                  {photos.length} Fotos
                </div>
                <div className="text-[11px] text-[#424752] mt-0.5">
                  Almacenadas en caché permanente
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#f3faff] border border-[#c2c6d4]">
                <div className="text-[12px] font-bold text-[#727783] uppercase tracking-wider">
                  Eventos de Bitácora
                </div>
                <div className="font-['Hanken_Grotesk'] text-2xl font-bold text-[#071e27] mt-1">
                  {activities.length} Registros
                </div>
                <div className="text-[11px] text-[#424752] mt-0.5">
                  Historial de acciones del inspector
                </div>
              </div>
            </div>

            {/* Backup & Restore Controls */}
            <div className="pt-2 border-t border-[#c2c6d4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                  Copia de Seguridad y Migración de Datos
                </div>
                <div className="text-[13px] text-[#424752]">
                  Descarga un archivo <code className="text-[#004d99] font-mono text-[12px]">.json</code> para guardar tus fotos en la PC o transferirlas a tu celular.
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex-1 sm:flex-none px-4 py-2 bg-[#004d99] hover:bg-[#1565c0] text-white font-['Inter'] font-bold text-[13px] rounded-lg transition-colors flex items-center justify-center gap-2 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Descargar Copia
                </button>

                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 sm:flex-none px-4 py-2 bg-white border border-[#004d99] text-[#004d99] hover:bg-[#e6f6ff] font-['Inter'] font-bold text-[13px] rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                  {isImporting ? 'Cargando...' : 'Restaurar Copia'}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Optional Supabase Cloud Sync Section (Secondary) */}
        <section className="bg-white border border-[#c2c6d4] rounded-xl overflow-hidden shadow-2xs">
          <div className="bg-[#F5F7F8] px-4 py-3 border-b border-[#c2c6d4] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#004d99]">cloud_sync</span>
              <h2 className="font-['Hanken_Grotesk'] font-bold text-base text-[#071e27]">
                Sincronización en la Nube (Opcional)
              </h2>
            </div>
            {onOpenSupabaseModal && (
              <button
                type="button"
                onClick={onOpenSupabaseModal}
                className="text-[12px] font-bold text-[#004d99] hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">database</span>
                Ver Esquema SQL
              </button>
            )}
          </div>
          <div className="p-4 sm:p-5 text-[13px] text-[#424752] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              Actualmente estás utilizando la <strong>memoria local del usuario</strong> en tu PC o celular. Si en el futuro deseas conectar Supabase para sincronización multi-dispositivo en tiempo real, puedes configurar las tablas SQL correspondientes.
            </div>
            {onOpenSupabaseModal && (
              <button
                type="button"
                onClick={onOpenSupabaseModal}
                className="px-3.5 py-1.5 rounded-lg border border-[#c2c6d4] bg-[#f3faff] text-[#004d99] hover:bg-[#cfe6f2] font-bold text-[12px] shrink-0"
              >
                Configurar Supabase
              </button>
            )}
          </div>
        </section>

        {/* Profile Management Section */}
        <section className="bg-white border border-[#c2c6d4] rounded-xl overflow-hidden shadow-2xs">
          <div className="bg-[#F5F7F8] px-4 py-3 border-b border-[#c2c6d4] flex items-center justify-between">
            <h2 className="font-['Hanken_Grotesk'] font-bold text-lg text-[#071e27] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#004d99]">badge</span>
              Perfil del Inspector & Datos de Identificación
            </h2>
            <button
              type="button"
              onClick={onOpenProfile}
              className="px-3.5 py-1.5 bg-[#004d99] hover:bg-[#00468c] text-white font-['Inter'] font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Editar Perfil
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Inspector Summary Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#f3faff] p-4 rounded-xl border border-[#c2c6d4]">
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#004d99] shadow-sm shrink-0">
                <img
                  src={inspector.avatarUrl}
                  alt={inspector.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-['Hanken_Grotesk'] font-bold text-lg text-[#071e27]">
                    {inspector.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#004d99]/10 text-[#004d99] border border-[#004d99]/20">
                    {inspector.id || 'INSP-8842'}
                  </span>
                  {inspector.bloodType && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                      RH: {inspector.bloodType}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm font-medium text-[#424752]">
                  {inspector.role} • {inspector.company || 'Consorcio Eléctrico'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs text-[#727783] pt-1">
                  {inspector.documentId && (
                    <div>
                      <span className="font-semibold text-[#071e27]">Doc: </span>
                      <span className="font-mono">{inspector.documentId}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-[#071e27]">Email: </span>
                    <span>{inspector.email}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#071e27]">Tel: </span>
                    <span className="font-mono">{inspector.phone}</span>
                  </div>
                  {inspector.licenseNumber && (
                    <div>
                      <span className="font-semibold text-[#071e27]">Matrícula: </span>
                      <span className="font-mono">{inspector.licenseNumber}</span>
                    </div>
                  )}
                  {inspector.emergencyContactName && (
                    <div>
                      <span className="font-semibold text-[#071e27]">Emergencia: </span>
                      <span>{inspector.emergencyContactName} ({inspector.emergencyContactPhone || 'N/A'})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Security Row */}
            <div className="flex items-center justify-between pt-2 border-t border-[#c2c6d4]">
              <div>
                <div className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                  Seguridad y Contraseña
                </div>
                <div className="font-['Inter'] text-[13px] text-[#424752]">
                  Administra tu contraseña de acceso y credenciales de sesión local.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSecurityModal(true)}
                className="px-3.5 py-1.5 bg-white border border-[#c2c6d4] text-[#004d99] hover:bg-[#e6f6ff] font-['Inter'] font-bold text-xs rounded-lg transition-colors"
              >
                Cambiar Contraseña
              </button>
            </div>
          </div>
        </section>

        {/* Notification Settings Section */}
        <section className="bg-white border border-[#c2c6d4] rounded-xl overflow-hidden shadow-2xs">
          <div className="bg-[#F5F7F8] px-4 py-3 border-b border-[#c2c6d4]">
            <h2 className="font-['Hanken_Grotesk'] font-bold text-lg text-[#071e27]">
              Ajustes de Notificaciones
            </h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {/* Email Notifications */}
            <div className="flex items-center justify-between border-b border-[#c2c6d4] pb-4">
              <div>
                <div className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                  Notificaciones por Correo
                </div>
                <div className="font-['Inter'] text-[14px] text-[#424752]">
                  Recibe resúmenes diarios y alertas críticas por correo electrónico.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.emailNotifications}
                  onChange={() => handleToggle('emailNotifications')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#c2c6d4] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#004d99]"></div>
              </label>
            </div>

            {/* Push Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                  Notificaciones Push
                </div>
                <div className="font-['Inter'] text-[14px] text-[#424752]">
                  Obtén alertas instantáneas en tu dispositivo móvil para acciones inmediatas.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.pushNotifications}
                  onChange={() => handleToggle('pushNotifications')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#c2c6d4] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#004d99]"></div>
              </label>
            </div>
          </div>
        </section>

        {/* App Preferences Section */}
        <section className="bg-white border border-[#c2c6d4] rounded-xl overflow-hidden shadow-2xs">
          <div className="bg-[#F5F7F8] px-4 py-3 border-b border-[#c2c6d4]">
            <h2 className="font-['Hanken_Grotesk'] font-bold text-lg text-[#071e27]">
              Preferencias de la Aplicación
            </h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {/* Sync over Wi-Fi Only */}
            <div className="flex items-center justify-between border-b border-[#c2c6d4] pb-4">
              <div>
                <div className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                  Sincronizar solo con Wi-Fi
                </div>
                <div className="font-['Inter'] text-[14px] text-[#424752]">
                  Ahorra datos móviles restringiendo la sincronización solo a redes Wi-Fi.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.syncWifiOnly}
                  onChange={() => handleToggle('syncWifiOnly')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#c2c6d4] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#004d99]"></div>
              </label>
            </div>

            {/* High Quality Image Uploads */}
            <div className={canManageActaAssignment ? 'flex items-center justify-between border-b border-[#c2c6d4] pb-4' : 'flex items-center justify-between'}>
              <div>
                <div className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                  Subidas en Alta Calidad
                </div>
                <div className="font-['Inter'] text-[14px] text-[#424752]">
                  Sube fotos en su resolución original (puede influir en la velocidad de sincronización).
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.highQualityUploads}
                  onChange={() => handleToggle('highQualityUploads')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#c2c6d4] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#004d99]"></div>
              </label>
            </div>

            {canManageActaAssignment && (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                    Permitir asignación de actas a inspectores
                  </div>
                  <div className="font-['Inter'] text-[14px] text-[#424752]">
                    Cuando está activo, los inspectores pueden seleccionar o cambiar el acta asignada en las propiedades. La administración conserva este permiso siempre.
                  </div>
                </div>
                <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={localSettings.allowInspectorActaAssignment}
                    onChange={() => handleToggle('allowInspectorActaAssignment')}
                    className="sr-only peer"
                    aria-label="Permitir asignación de actas a inspectores"
                  />
                  <div className="h-6 w-11 rounded-full bg-[#c2c6d4] peer peer-checked:bg-[#004d99] peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:content-[''] after:transition-all"></div>
                </label>
              </div>
            )}
          </div>
        </section>

        {canResetOperationalData && onResetOperationalData && (
          <section className="overflow-hidden border border-[#f0b4b0] bg-white shadow-2xs">
            <div className="flex items-center gap-2 border-b border-[#f2d0cd] bg-[#fff5f4] px-4 py-3">
              <span className="material-symbols-outlined text-[#b42318]">warning</span>
              <div>
                <h2 className="font-['Hanken_Grotesk'] text-base font-bold text-[#7a1c16]">Zona de restablecimiento administrativo</h2>
                <p className="text-[12px] text-[#8c2f27]">Esta acción elimina información operativa de forma irreversible.</p>
              </div>
            </div>
            <div className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
              <p className="max-w-2xl text-[13px] leading-5 text-[#5d3c39]">Limpia inspecciones, tramos, fotos, colecciones, bitácora, plano JPG y caché local. Conserva perfiles, cuentas, roles, permisos y acceso administrativo.</p>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="inline-flex shrink-0 items-center gap-2 bg-[#b42318] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#8d1b13]"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                Restablecer datos
              </button>
            </div>
          </section>
        )}

        {/* Action Buttons */}
        <div className="pt-4 flex justify-end gap-4">
          <button
            type="button"
            onClick={handleDiscard}
            className="px-6 py-3 bg-[#f3faff] border border-[#c2c6d4] text-[#424752] font-['Inter'] font-bold text-[14px] rounded hover:bg-[#cfe6f2] transition-colors"
          >
            Descartar Cambios
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-3 bg-[#004d99] text-white font-['Inter'] font-bold text-[14px] rounded hover:bg-[#00468c] transition-colors shadow-xs"
          >
            Guardar Preferencias
          </button>
        </div>
      </div>

      {/* Security & Password Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#c2c6d4] shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c2c6d4]">
              <h3 className="font-['Hanken_Grotesk'] font-bold text-xl text-[#071e27]">
                Seguridad y Autenticación
              </h3>
              <button
                type="button"
                onClick={() => setShowSecurityModal(false)}
                className="text-[#424752] hover:text-[#ba1a1a]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSecuritySave} className="space-y-4">
              <div className="p-3 bg-[#e6f6ff] rounded-lg border border-[#c2c6d4] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[13px] text-[#071e27]">Autenticación de Dos Factores</div>
                  <div className="text-[12px] text-[#424752]">Requerir clave física o SMS al iniciar sesión</div>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactorEnabled}
                  onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                  className="w-5 h-5 text-[#004d99] rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-[13px] text-[#071e27] mb-1">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-lg p-2.5 text-[14px]"
                />
              </div>

              <div>
                <label className="block font-bold text-[13px] text-[#071e27] mb-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Introduce nueva contraseña (12+ caracteres)"
                  className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-lg p-2.5 text-[14px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#c2c6d4]">
                <button
                  type="button"
                  onClick={() => setShowSecurityModal(false)}
                  className="px-4 py-2 border border-[#c2c6d4] text-[#424752] font-bold text-[13px] rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004d99] text-white font-bold text-[13px] rounded-lg hover:bg-[#00468c]"
                >
                  Guardar Seguridad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isResetModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-labelledby="reset-operational-data-title" className="w-full max-w-lg border border-[#e4aaa5] bg-white shadow-[0_24px_72px_rgba(105,35,29,0.36)]">
            <div className="flex items-start gap-3 border-b border-[#f2d0cd] bg-[#fff5f4] px-5 py-4">
              <span className="material-symbols-outlined mt-0.5 text-[25px] text-[#b42318]">delete_forever</span>
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[#8c2f27]">ACCIÓN IRREVERSIBLE</p>
                <h2 id="reset-operational-data-title" className="mt-1 text-lg font-bold text-[#4a1714]">¿Restablecer los datos de inspección?</h2>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm leading-6 text-[#5d3c39]">Se eliminarán los registros de inspección, fotos, tramos, colecciones, bitácora y datos locales del plano. Los perfiles, usuarios, roles, permisos y la configuración de acceso se conservarán.</p>
              {resetFeedback && (
                <div
                  role={resetFeedback.type === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                  className={`flex items-start gap-3 border px-3.5 py-3 text-sm leading-5 ${
                    resetFeedback.type === 'loading'
                      ? 'border-[#9ccde4] bg-[#eef8fd] text-[#174d69]'
                      : resetFeedback.type === 'success'
                        ? 'border-[#9bcda4] bg-[#f0f9f1] text-[#1f6430]'
                        : 'border-[#e8aaa4] bg-[#fff4f2] text-[#8d1b13]'
                  }`}
                >
                  {resetFeedback.type === 'loading' ? (
                    <span aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#77b9dc] border-t-[#075b87]" />
                  ) : (
                    <span aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[20px]">
                      {resetFeedback.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.09em]">
                      {resetFeedback.type === 'loading' ? 'Restablecimiento en curso' : resetFeedback.type === 'success' ? 'Restablecimiento finalizado' : 'No se completó el restablecimiento'}
                    </p>
                    <p className="mt-1">{resetFeedback.message}</p>
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="reset-confirmation" className="mb-1.5 block text-xs font-bold text-[#4a1714]">Escribe <strong>RESTABLECER</strong> para habilitar la acción.</label>
                <input
                  id="reset-confirmation"
                  value={resetPhrase}
                  onChange={(event) => setResetPhrase(event.target.value)}
                  placeholder="RESTABLECER"
                  autoComplete="off"
                  disabled={isResetting || resetFeedback?.type === 'success'}
                  className="h-11 w-full border border-[#e2aaa5] bg-[#fffafa] px-3 font-mono text-sm font-bold text-[#4a1714] outline-none transition focus:border-[#b42318] focus:ring-2 focus:ring-[#b42318]/15 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#f2d0cd] px-5 py-4">
              <button type="button" disabled={isResetting} onClick={() => { setIsResetModalOpen(false); setResetPhrase(''); setResetFeedback(null); }} className="h-9 border border-[#b4cbd8] bg-white px-3 text-xs font-bold text-[#315c70] transition hover:bg-[#eaf6fb] disabled:opacity-50">{resetFeedback?.type === 'success' ? 'Cerrar' : 'Cancelar'}</button>
              {resetFeedback?.type !== 'success' && (
                <button type="button" disabled={isResetting || resetPhrase.trim().toUpperCase() !== 'RESTABLECER'} onClick={handleOperationalReset} className="inline-flex h-9 items-center gap-1.5 bg-[#b42318] px-3 text-xs font-bold text-white transition hover:bg-[#8d1b13] disabled:cursor-not-allowed disabled:opacity-40">
                  {isResetting ? (
                    <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/45 border-t-white" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  )}
                  {isResetting ? 'Restableciendo datos…' : resetFeedback?.type === 'error' ? 'Reintentar' : 'Eliminar datos operativos'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
