/**
 * Diseño: cartografía técnica sobria. La barra superior conserva una marca
 * operativa, legible y alineada con los controles del plano.
 */
import React, { useState } from 'react';
import { InspectorProfile, ActivityItem, AppModule } from '../types';
import type { SupabaseConnectionState } from '../hooks/useSupabaseConnection';

interface TopNavBarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  inspector: InspectorProfile;
  allowedModules: AppModule[];
  isAdmin: boolean;
  onOpenProfile: () => void;
  activities: ActivityItem[];
  onOpenPhoto: (photoId: string) => void;
  onToggleMobileMenu: () => void;
  onOpenAuth?: () => void;
  onOpenSupabaseModal?: () => void;
  connectionState: SupabaseConnectionState;
  onRefreshConnection: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  currentTab,
  onTabChange,
  inspector,
  allowedModules,
  isAdmin,
  onOpenProfile,
  activities,
  onOpenPhoto,
  onToggleMobileMenu,
  onOpenAuth,
  onOpenSupabaseModal,
  connectionState,
  onRefreshConnection,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const isGalleryActive = currentTab === 'dashboard' || currentTab === 'detail';
  const isMapActive = currentTab === 'map';
  const isDatabaseActive = currentTab === 'database';
  const isHistoryActive = currentTab === 'history' || currentTab === 'collections';
  const isUploadActive = currentTab === 'upload';
  const isActivityActive = currentTab === 'activity';
  const canUseModule = (module: AppModule) => isAdmin || allowedModules.includes(module);
  const connectionPresentation = {
    checking: {
      label: 'Verificando conexión',
      title: 'Verificando la conexión con Supabase. Haz clic para actualizar el estado.',
      dotClass: 'bg-amber-500 animate-pulse',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    connected: {
      label: 'Conectado a Supabase',
      title: 'Conectado a Supabase. Haz clic para comprobar nuevamente.',
      dotClass: 'bg-emerald-500',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    disconnected: {
      label: 'Sin conexión a Supabase',
      title: 'Sin conexión a Supabase. Los cambios se conservan localmente; haz clic para reintentar.',
      dotClass: 'bg-[#ba1a1a]',
      badgeClass: 'border-red-200 bg-red-50 text-[#9b1c1c]',
    },
  }[connectionState];
  const desktopNavItems: Array<{ id: AppModule; label: string; icon?: string; isActive: boolean }> = [
    { id: 'dashboard', label: 'Galería', isActive: isGalleryActive },
    { id: 'map', label: 'Plano', icon: 'map', isActive: isMapActive },
    { id: 'database', label: 'Base de Datos', icon: 'database', isActive: isDatabaseActive },
    { id: 'history', label: 'Historial', isActive: isHistoryActive },
    { id: 'upload', label: 'Subir', isActive: isUploadActive },
    { id: 'activity', label: 'Actividad', isActive: isActivityActive },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-4 sm:px-6 h-16 bg-[#f3faff] border-b border-[#c2c6d4] shadow-xs">
        {/* Left: Brand & Mobile Menu button */}
        <div className="flex items-center gap-3 md:gap-6">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-[#424752] hover:text-[#004d99] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004d99]"
            aria-label="Abrir menú de navegación"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className="text-left font-['Hanken_Grotesk'] text-xl sm:text-2xl font-bold text-[#004d99] hover:opacity-90 transition-opacity tracking-tight flex items-center gap-2"
          >
            <span>TRACKING LA NUBIA</span>
          </button>

          {/* Desktop Nav links */}
          <nav className="hidden md:flex items-center space-x-6 ml-6">
            {desktopNavItems.filter((item) => canUseModule(item.id)).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`pb-1 font-['Inter'] text-[14px] font-bold tracking-[0.02em] transition-all relative flex items-center gap-1.5 ${
                  item.isActive
                    ? 'text-[#004d99] border-b-2 border-[#004d99]'
                    : 'text-[#424752] hover:text-[#004d99]'
                }`}
              >
                {item.icon && <span className="material-symbols-outlined text-[16px]">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right Action Icons & Avatar */}
        <div className="flex items-center gap-2 sm:gap-3 relative">
          <button
            type="button"
            onClick={onRefreshConnection}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#004d99] ${connectionPresentation.badgeClass}`}
            title={connectionPresentation.title}
            aria-label={`Estado de conexión: ${connectionPresentation.label}. Activar para actualizar.`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${connectionPresentation.dotClass}`} aria-hidden="true"></span>
            <span className="hidden sm:inline">{connectionPresentation.label}</span>
            <span className="sm:hidden">{connectionState === 'connected' ? 'En línea' : connectionState === 'disconnected' ? 'Sin red' : '…'}</span>
          </button>

          {/* Local Device Storage Active Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold" title="Tus fotos y datos se guardan en la memoria de tu PC o celular">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Memoria Local Activa</span>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-1.5 text-[#424752] hover:text-[#004d99] hover:bg-[#cfe6f2]/50 rounded-lg transition-colors relative"
              title="Notificaciones"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {activities.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full ring-2 ring-[#f3faff]"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#c2c6d4] rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3 bg-[#e6f6ff] border-b border-[#c2c6d4] flex items-center justify-between">
                  <div className="font-['Hanken_Grotesk'] font-bold text-[#071e27] text-[15px]">Alertas y Registro de Campo</div>
                  <span className="text-[11px] bg-[#004d99] text-white px-2 py-0.5 rounded font-bold">En Vivo</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#dbf1fe]">
                  {activities.length === 0 ? (
                    <div className="p-4 text-center text-[13px] text-[#727783]">No hay actividades recientes.</div>
                  ) : (
                    activities.slice(0, 5).map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          onOpenPhoto(act.photoId);
                          setShowNotifications(false);
                        }}
                        className="w-full text-left p-3 hover:bg-[#f3faff] transition-colors flex items-start gap-3"
                      >
                        <span className={`material-symbols-outlined text-[18px] mt-0.5 ${
                          act.type === 'flag' ? 'text-[#ba1a1a]' : act.type === 'verified' ? 'text-[#1b6d24]' : 'text-[#004d99]'
                        }`}>
                          {act.type === 'flag' ? 'warning' : act.type === 'verified' ? 'check_circle' : 'cloud_done'}
                        </span>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-[#071e27]">{act.action}</div>
                          <div className="text-[12px] text-[#424752] truncate">{act.photoName}</div>
                          <div className="text-[11px] text-[#727783] mt-0.5">{act.timestamp} por {act.user}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-[#c2c6d4] bg-[#f3faff] text-center">
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange('activity');
                      setShowNotifications(false);
                    }}
                    className="text-[12px] font-bold text-[#004d99] hover:underline"
                  >
                    Ver Todo el Historial de Actividad
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Help Button */}
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 text-[#424752] hover:text-[#004d99] hover:bg-[#cfe6f2]/50 rounded-lg transition-colors"
            title="Ayuda e Información del Sistema"
          >
            <span className="material-symbols-outlined text-[22px]">help_outline</span>
          </button>

          {/* Supabase Auth / User Button */}
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0f4f8] text-[#424752] hover:bg-[#e2e8f0] font-['Inter'] font-bold text-[12px] transition-all"
              title="Autenticación con Supabase"
            >
              <span className="material-symbols-outlined text-[16px]">lock_person</span>
              <span>Auth</span>
            </button>
          )}

          {/* Avatar Profile Trigger */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 group p-0.5 rounded-full hover:ring-2 hover:ring-[#004d99] transition-all"
            title="Ver Perfil del Inspector"
          >
            <img
              src={inspector.avatarUrl}
              alt={inspector.name}
              className="w-8 h-8 rounded-full object-cover border border-[#c2c6d4]"
            />
          </button>
        </div>
      </header>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#c2c6d4] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#e6f6ff] p-4 border-b border-[#c2c6d4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004d99]">info</span>
                <h3 className="font-['Hanken_Grotesk'] font-bold text-[#071e27] text-lg">Sistema PhotoVault Pro</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-[#424752] hover:text-[#ba1a1a]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4 text-[14px] text-[#424752]">
              <p>
                <strong>PhotoVault Pro</strong> es una plataforma de grado industrial para la gestión fotográfica y sincronización de metadatos de inspecciones en campo.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                <li><strong>Galería / Panel:</strong> Revisa cargas de obra, renombra inspecciones directamente y filtra por estado.</li>
                <li><strong>Detalle de Foto:</strong> Visor interactivo en alta resolución con zoom, metadatos, notas de campo e interruptores de verificación.</li>
                <li><strong>Subida:</strong> Arrastra y suelta imágenes de campo, asigna terminales y marcadores de riesgo.</li>
                <li><strong>Tablas Supabase:</strong> Esquema SQL completo con tablas para registros de inspección, perfil del inspector y auditoría.</li>
              </ul>
              <div className="pt-3 border-t border-[#c2c6d4] text-[12px] text-[#727783] flex justify-between">
                <span>Versión Terminal: v4.8.2-PRO</span>
                <span>Señal: Sincronizado 100%</span>
              </div>
            </div>
            <div className="p-3 bg-[#f3faff] border-t border-[#c2c6d4] flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-[#004d99] text-white rounded font-bold text-[13px] hover:bg-[#1565c0]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
