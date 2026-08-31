/**
 * Diseño: cartografía técnica sobria. Los permisos reflejan módulos operativos
 * concretos y no dependen de controles visuales aislados.
 */
import { AppModule, AppRole, UserAccess } from '../types';

export const PRIMARY_ADMIN_EMAIL = 'jheanmurillo73@gmail.com';

export const MODULE_DEFINITIONS: Array<{ id: AppModule; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Panel principal', icon: 'dashboard' },
  { id: 'map', label: 'Mapa de obra', icon: 'map' },
  { id: 'database', label: 'Base de datos', icon: 'database' },
  { id: 'upload', label: 'Subir elemento', icon: 'add_a_photo' },
  { id: 'history', label: 'Historial', icon: 'history' },
  { id: 'activity', label: 'Actividad', icon: 'monitoring' },
  { id: 'settings', label: 'Configuración', icon: 'settings' },
];

export const ALL_OPERATIONAL_MODULES = MODULE_DEFINITIONS.map((module) => module.id);
export const DEFAULT_INSPECTOR_MODULES: AppModule[] = ['dashboard', 'map', 'history'];

export const isPrimaryAdmin = (email?: string) =>
  email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;

export const normalizeModules = (modules: unknown): AppModule[] => {
  if (!Array.isArray(modules)) return [...DEFAULT_INSPECTOR_MODULES];
  const valid = modules.filter((module): module is AppModule =>
    MODULE_DEFINITIONS.some((definition) => definition.id === module),
  );
  return valid.length > 0 ? Array.from(new Set(valid)) : [];
};

export const createFallbackAccess = (profile: Pick<UserAccess, 'id' | 'email' | 'name'>): UserAccess => {
  const role: AppRole = isPrimaryAdmin(profile.email) ? 'admin' : 'inspector';
  return {
    ...profile,
    role,
    allowedModules: role === 'admin' ? [...ALL_OPERATIONAL_MODULES] : [...DEFAULT_INSPECTOR_MODULES],
  };
};

export const canAccessModule = (access: UserAccess, module: AppModule) =>
  access.role === 'admin' || (module !== 'upload' && access.allowedModules.includes(module));
