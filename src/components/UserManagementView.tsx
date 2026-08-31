/**
 * Diseño: cartografía técnica sobria. La administración presenta permisos como
 * una matriz operativa, manteniendo legibles los controles críticos de acceso.
 */
import React, { useEffect, useState } from 'react';
import { AppModule, AppRole, UserAccess } from '../types';
import { ALL_OPERATIONAL_MODULES, isPrimaryAdmin, MODULE_DEFINITIONS, PRIMARY_ADMIN_EMAIL } from '../lib/accessControl';
import { supabaseService } from '../services/supabaseService';

interface UserManagementViewProps {
  currentUser: UserAccess;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, onShowToast }) => {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setLoadError(null);
    const remoteUsers = await supabaseService.listUserAccess();
    if (!remoteUsers) {
      setLoadError('No fue posible cargar los perfiles. Ejecuta el Script SQL de Supabase y verifica que tu sesión tenga rol administrador.');
      setUsers([currentUser]);
    } else {
      setUsers(remoteUsers);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const patchUser = (userId: string, patch: Partial<UserAccess>) => {
    setUsers((previous) => previous.map((user) => (user.id === userId ? { ...user, ...patch } : user)));
  };

  const toggleModule = (user: UserAccess, module: AppModule) => {
    if (user.role === 'admin' || isPrimaryAdmin(user.email)) return;
    const allowedModules = user.allowedModules.includes(module)
      ? user.allowedModules.filter((current) => current !== module)
      : [...user.allowedModules, module];
    patchUser(user.id, { allowedModules });
  };

  const changeRole = (user: UserAccess, role: AppRole) => {
    if (isPrimaryAdmin(user.email)) return;
    patchUser(user.id, {
      role,
      allowedModules: role === 'admin' ? [...ALL_OPERATIONAL_MODULES] : user.allowedModules,
    });
  };

  const saveUser = async (user: UserAccess) => {
    setSavingId(user.id);
    const saved = await supabaseService.updateUserAccess(
      user.id,
      isPrimaryAdmin(user.email) ? 'admin' : user.role,
      isPrimaryAdmin(user.email) ? ALL_OPERATIONAL_MODULES : user.allowedModules,
    );
    setSavingId(null);

    if (saved) {
      onShowToast(`Accesos actualizados para ${user.name}`, 'success');
      await loadUsers();
    } else {
      onShowToast('No se pudieron guardar los accesos. Revisa el Script SQL y las políticas RLS.', 'error');
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-[#b9d3df] bg-[#073f74] px-5 py-6 text-white shadow-[0_14px_32px_rgba(7,63,116,0.16)] sm:px-7">
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(156,230,255,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(156,230,255,0.45) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-cyan-100">CONTROL / ACCESOS</p>
            <h1 className="mt-1 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.03em]">Administración de usuarios</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/80">Designa administradores y delimita los módulos operativos disponibles para cada inspector.</p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">Administrador principal</p>
            <p className="mt-0.5 text-sm font-bold">{PRIMARY_ADMIN_EMAIL}</p>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#071e27]">Perfiles registrados</h2>
          <p className="mt-0.5 text-sm text-[#4e6572]">Los inspectores reciben los módulos definidos por el administrador. Los administradores cuentan con acceso completo.</p>
        </div>
        <button type="button" onClick={loadUsers} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#a9c9d7] bg-white px-3 py-2 text-xs font-bold text-[#004d99] transition-colors hover:bg-[#e6f6ff]">
          <span className="material-symbols-outlined text-[17px]">refresh</span>
          Actualizar
        </button>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <span className="material-symbols-outlined mt-0.5 text-amber-700">warning</span>
          <p>{loadError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-[#c2d6df] bg-white p-8 text-center text-sm text-[#58717e]">Cargando perfiles y permisos…</div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => {
            const primary = isPrimaryAdmin(user.email);
            const effectiveRole: AppRole = primary ? 'admin' : user.role;
            const effectiveModules = effectiveRole === 'admin' ? ALL_OPERATIONAL_MODULES : user.allowedModules;
            const emailConfirmed = Boolean(user.emailConfirmedAt);
            const emailStatusAvailable = user.emailConfirmedAt !== undefined;
            return (
              <article key={user.id} className="overflow-hidden rounded-2xl border border-[#c2d6df] bg-white shadow-[0_4px_16px_rgba(7,62,92,0.06)]">
                <div className="flex flex-col gap-4 border-b border-[#e0edf2] bg-[#f7fbfc] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-['Space_Grotesk'] text-base font-bold text-[#071e27]">{user.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${effectiveRole === 'admin' ? 'bg-[#e8f0fe] text-[#004d99]' : 'bg-[#e6f7ef] text-[#127245]'}`}>
                        {effectiveRole === 'admin' ? 'Administrador' : 'Inspector'}
                      </span>
                      {primary && <span className="rounded-full bg-[#fff5d7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a5a00]">Principal</span>}
                      <span title={emailConfirmed ? `Confirmado el ${new Date(user.emailConfirmedAt as string).toLocaleString('es-CO')}` : emailStatusAvailable ? 'El usuario aún debe confirmar el enlace enviado por Supabase.' : 'Ejecuta el Script SQL actualizado para sincronizar este estado.'} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${emailConfirmed ? 'bg-[#dcfce7] text-[#166534]' : emailStatusAvailable ? 'bg-[#fff4cc] text-[#8a5a00]' : 'bg-slate-100 text-slate-600'}`}>
                        <span className="material-symbols-outlined text-[14px]">{emailConfirmed ? 'verified' : emailStatusAvailable ? 'mark_email_unread' : 'help'}</span>
                        {emailConfirmed ? 'Correo confirmado' : emailStatusAvailable ? 'Correo pendiente' : 'Estado no disponible'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-[#4e6572]">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[#304955]" htmlFor={`role-${user.id}`}>Rol</label>
                    <select id={`role-${user.id}`} value={effectiveRole} disabled={primary} onChange={(event) => changeRole(user, event.target.value as AppRole)} className="rounded-lg border border-[#b9d3df] bg-white px-3 py-2 text-sm font-semibold text-[#17313d] disabled:cursor-not-allowed disabled:bg-slate-100">
                      <option value="inspector">Inspector</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-[#17313d]">Módulos autorizados</h4>
                      <p className="mt-0.5 text-xs text-[#58717e]">{effectiveRole === 'admin' ? 'Acceso completo por rol administrativo.' : 'Selecciona únicamente las áreas de trabajo asignadas a este inspector.'}</p>
                    </div>
                    <button type="button" onClick={() => saveUser(user)} disabled={savingId === user.id} className="inline-flex items-center gap-2 rounded-xl bg-[#004d99] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#003b76] disabled:cursor-wait disabled:opacity-60">
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      {savingId === user.id ? 'Guardando…' : 'Guardar accesos'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {MODULE_DEFINITIONS.map((module) => {
                      const checked = effectiveModules.includes(module.id);
                      return (
                        <label key={module.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${checked ? 'border-[#87bdd6] bg-[#eef9fd] text-[#073f74]' : 'border-[#d8e5ea] bg-white text-[#627682]'} ${effectiveRole === 'admin' ? 'cursor-default' : 'cursor-pointer hover:border-[#87bdd6]'}`}>
                          <input type="checkbox" checked={checked} disabled={effectiveRole === 'admin'} onChange={() => toggleModule(user, module.id)} className="h-4 w-4 accent-[#004d99]" />
                          <span className="material-symbols-outlined text-[18px]">{module.icon}</span>
                          <span className="font-semibold">{module.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
