import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const files = {
  access: readFileSync(resolve(projectRoot, 'client/src/lib/accessControl.ts'), 'utf8'),
  service: readFileSync(resolve(projectRoot, 'client/src/services/supabaseService.ts'), 'utf8'),
  app: readFileSync(resolve(projectRoot, 'client/src/App.tsx'), 'utf8'),
  sideNav: readFileSync(resolve(projectRoot, 'client/src/components/SideNavBar.tsx'), 'utf8'),
  management: readFileSync(resolve(projectRoot, 'client/src/components/UserManagementView.tsx'), 'utf8'),
  authScreen: readFileSync(resolve(projectRoot, 'client/src/components/AuthScreen.tsx'), 'utf8'),
  authModal: readFileSync(resolve(projectRoot, 'client/src/components/AuthModal.tsx'), 'utf8'),
};

const expected = [
  ['access', "PRIMARY_ADMIN_EMAIL = 'jheanmurillo73@gmail.com'"],
  ['access', 'DEFAULT_INSPECTOR_MODULES'],
  ['access', 'canAccessModule'],
  ['service', 'allowed_modules JSONB'],
  ['service', 'photovault_is_admin'],
  ['service', 'photovault_can_access_module'],
  ['service', 'enforce_photovault_profile_access'],
  ['app', 'UserManagementView'],
  ['app', "tab === 'admin' && userAccess.role !== 'admin'"],
  ['sideNav', "id: 'admin'"],
  ['management', 'Administración de usuarios'],
  ['management', 'Guardar accesos'],
  ['authScreen', 'registeringAsPrimaryAdmin = isPrimaryAdmin(email)'],
  ['authScreen', "role: registeringAsPrimaryAdmin ? 'Administrador principal' : 'Inspector de Campo'"],
  ['authScreen', 'Este correo se registrará como administrador principal.'],
  ['authScreen', 'const handleResendConfirmation = async () =>'],
  ['authScreen', 'emailRedirectTo: window.location.origin'],
  ['authScreen', 'Reenviar enlace'],
  ['authModal', "role: isPrimaryAdmin(email) ? 'Administrador principal' : 'Inspector de Campo'"],
  ['authModal', 'emailRedirectTo: window.location.origin'],
];

const failures = expected
  .filter(([file, fragment]) => !files[file].includes(fragment))
  .map(([file, fragment]) => `${file}: falta «${fragment}»`);

if (failures.length > 0) {
  console.error('La validación de roles y permisos falló:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Validación superada: roles, módulos asignables y políticas de administración están presentes.');
