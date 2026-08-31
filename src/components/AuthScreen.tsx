/**
 * Diseño: cartografía técnica sobria. El acceso anticipa el plano con una
 * retícula, una marca de tres categorías y lenguaje de operación verificable.
 */
import React, { useState, useRef } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { InspectorProfile } from '../types';
import { isPrimaryAdmin, PRIMARY_ADMIN_EMAIL } from '../lib/accessControl';

interface AuthScreenProps {
  onAuthSuccess: (profile: InspectorProfile, email: string) => void;
  defaultInspector: InspectorProfile;
}

const AVATAR_OPTIONS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDiDBbLLvg2B5k0M06HZaqqowCMmsx43C7fxTCQaVlaJESX35l_Zm_vvaVMHFW4cKQB4PBFEPQjmy9pmvbTElsz9c6-g_dokmoFe-j8qcIehL-VdSKN5BdaJw4j_dhYqqMe5cIkr9ygYoZ7kwM9AV-b2nTUJCgy9R0iLKi17lAdIPFmbjb0XdEa6BNI6wz_m8jGCGdKWJ71ATrWcI6mskw58SqOO4HhrjAsRB0AXdmBhkZhGPeYt0uL',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBLct-mcOO8oUrLsDHGt-X85lwC_UOjvDkeo8E3zrns8Ewq63d1OKsFDJkXOeXVmkULhIQxMQOuSruq4sqtZ76Y_9dtgiJg_8NPSQ1oaR3LNBmyU0a1g5LU5nHqBWPBEAyfZXD2J_3jIMXM0-AcZgYv-vzuHJ88iomH8SbVd-ekvPT8760UN2X8qwyFBdVW3g8rg-pk08T230cofMKQsv-s8qAMlWOVaIGFbwqC1-W5EmgOx3pzEP_G',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCDnFWPNGSYOLqVupc5YdYJt21nDuD6yTY9Ez8Zq1u5NkHepgtnAsucBlPoWnteF0lyXeGDGAIAAl6dMaLmjhoZGn7tWaC-UXw2D1ZHtcoutN0iyHR71-Fn7Uyl8ylYfJnUalNFw3a_jn_WKDT-MP5KXERnCJe2Xt7xKfUNNtiRO-ZesLCAzk1deNozabpoMA7l51uNyNKdw-3Z8Kjj-YUhVCoruiqINdxR6JQIPAoe4vRgBs4tnGK-',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBrCVp0754qvCMfbDye_Gdn3X5wIGxd-ZT0yib9F-awmwuRKd6IUcWB_RTHr3neCS5Wu1o-Rmz6mPEfHOt6AQJ6kSlYrGylV8H_rEl-SzVun3xDrWEXT--z__ZMznDDWWIOPMbEP85upKzxU_bE2R-tK31k5gXxW6Kq9T-v5sRFLRtnk3-rKU_2KX2ey77mpITzYBx3xugPaoEIup4OiqJCREhslk8lmw9AusK9LnWWAgY1JiqZY_h-',
];

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  defaultInspector,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [documentId, setDocumentId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [company, setCompany] = useState<string>('Consorcio Eléctrico de Occidente');
  const [licenseNumber, setLicenseNumber] = useState<string>('');
  const [terminal, setTerminal] = useState<string>('Terminal A-12 (Zona Norte)');
  const [department, setDepartment] = useState<string>('Operaciones de Campo');
  const [bloodType, setBloodType] = useState<string>('O+');
  const [avatarUrl, setAvatarUrl] = useState<string>(defaultInspector.avatarUrl || AVATAR_OPTIONS[0]);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isConfigured = isSupabaseConfigured();
  const registeringAsPrimaryAdmin = isPrimaryAdmin(email);

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail) return;
    const client = getSupabaseClient();
    if (!client || !isConfigured) {
      setErrorMsg('No fue posible preparar el reenvío porque Supabase no está configurado.');
      return;
    }

    setIsResendingConfirmation(true);
    setErrorMsg(null);
    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email: pendingConfirmationEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setSuccessMsg(`Enviamos un nuevo enlace de confirmación a ${pendingConfirmationEmail}. Revisa también la carpeta de spam.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo reenviar el correo de confirmación.');
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          canvas.width = Math.min(minDim, maxDim);
          canvas.height = Math.min(minDim, maxDim);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, canvas.width, canvas.height);
            setAvatarUrl(canvas.toDataURL('image/jpeg', 0.85));
          }
        } catch {
          setAvatarUrl(ev.target?.result as string);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const client = getSupabaseClient();

      if (client && isConfigured) {
        // Live Supabase Sign In
        const { data, error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw error;
        }

        const user = data.user;
        const meta = user?.user_metadata || {};

        const profile: InspectorProfile = {
          id: user?.id || defaultInspector.id,
          name: meta.full_name || meta.name || email.split('@')[0],
          email: user?.email || email.trim(),
          role: isPrimaryAdmin(user?.email || email) ? 'Administrador principal' : 'Inspector de Campo',
          terminal: meta.terminal || terminal || 'Terminal A-12',
          department: meta.department || department || 'Control de Calidad',
          avatarUrl: meta.avatar_url || defaultInspector.avatarUrl,
          phone: meta.phone || defaultInspector.phone,
          documentId: meta.document_id || defaultInspector.documentId,
          company: meta.company || defaultInspector.company,
          licenseNumber: meta.license_number || defaultInspector.licenseNumber,
          bloodType: meta.blood_type || defaultInspector.bloodType,
          emergencyContactName: defaultInspector.emergencyContactName,
          emergencyContactPhone: defaultInspector.emergencyContactPhone,
        };

        onAuthSuccess(profile, profile.email);
      } else {
        // Local / Fast access fallback
        await new Promise((resolve) => setTimeout(resolve, 300));

        const derivedName = email.includes('@')
          ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : 'Inspector Autorizado';

        const profile: InspectorProfile = {
          id: `INSP-${Math.floor(1000 + Math.random() * 9000)}`,
          name: derivedName,
          email: email.trim() || 'inspector@empresa.com',
          role: 'Inspector de Redes',
          terminal,
          department,
          avatarUrl: defaultInspector.avatarUrl,
          phone: defaultInspector.phone,
          documentId: defaultInspector.documentId,
          company: defaultInspector.company,
          licenseNumber: defaultInspector.licenseNumber,
          bloodType: defaultInspector.bloodType,
        };

        onAuthSuccess(profile, profile.email);
      }
    } catch (err: any) {
      console.warn('Supabase Sign In warning:', err);
      const isPathOrNetError =
        err?.message?.includes('Invalid path') ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('network');

      if (isPathOrNetError) {
        const derivedName = email.includes('@')
          ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : 'Inspector Autorizado';

        const profile: InspectorProfile = {
          id: `INSP-${Math.floor(1000 + Math.random() * 9000)}`,
          name: derivedName,
          email: email.trim() || 'inspector@empresa.com',
          role: 'Inspector de Campo',
          terminal,
          department,
          avatarUrl: defaultInspector.avatarUrl,
          phone: defaultInspector.phone,
        };

        onAuthSuccess(profile, profile.email);
      } else {
        const message = err?.message || 'Error al autenticar. Verifica tu correo y contraseña.';
        if (/email not confirmed|email_not_confirmed/i.test(message)) {
          setPendingConfirmationEmail(email.trim());
          setErrorMsg('El correo aún no ha sido confirmado. Solicita un nuevo enlace de activación antes de iniciar sesión.');
        } else {
          setErrorMsg(message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!fullName.trim()) {
      setErrorMsg('Por favor ingresa tu nombre completo.');
      setLoading(false);
      return;
    }

    try {
      const client = getSupabaseClient();

      if (client && isConfigured) {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              terminal,
              department,
              document_id: documentId.trim(),
              phone: phone.trim(),
              company: company.trim(),
              license_number: licenseNumber.trim(),
              blood_type: bloodType,
              avatar_url: avatarUrl,
            },
          },
        });

        if (error) {
          throw error;
        }

        const user = data.user;
        const profile: InspectorProfile = {
          id: user?.id || `INSP-${Date.now().toString().slice(-4)}`,
          name: fullName.trim(),
          email: email.trim(),
          role: registeringAsPrimaryAdmin ? 'Administrador principal' : 'Inspector de Campo',
          terminal,
          department,
          avatarUrl,
          phone: phone.trim() || '+57 300 000 0000',
          documentId: documentId.trim(),
          company: company.trim(),
          licenseNumber: licenseNumber.trim(),
          bloodType,
        };

        if (data.session) {
          onAuthSuccess(profile, profile.email);
        } else {
          setPendingConfirmationEmail(email.trim());
          setSuccessMsg(registeringAsPrimaryAdmin
            ? 'Cuenta administrador creada. Confirma el correo enviado por Supabase y luego inicia sesión para activar los privilegios.'
            : '¡Registro completado en Supabase! Confirma el correo si Supabase lo solicita y luego inicia sesión con tu cuenta.');
          setMode('signin');
        }
      } else {
        // Fallback local registration
        await new Promise((resolve) => setTimeout(resolve, 300));

        const profile: InspectorProfile = {
          id: `INSP-${Math.floor(1000 + Math.random() * 9000)}`,
          name: fullName.trim(),
          email: email.trim() || 'inspector@empresa.com',
          role: registeringAsPrimaryAdmin ? 'Administrador principal' : 'Inspector de Campo',
          terminal,
          department,
          avatarUrl,
          phone: phone.trim() || '+57 300 000 0000',
          documentId: documentId.trim() || 'CC 1.000.000.000',
          company: company.trim() || 'Consorcio Eléctrico',
          licenseNumber: licenseNumber.trim() || 'MP-CONTE',
          bloodType,
        };

        onAuthSuccess(profile, profile.email);
      }
    } catch (err: any) {
      console.warn('Supabase Sign Up warning:', err);
      const isPathOrNetError =
        err?.message?.includes('Invalid path') ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('network') ||
        err?.message?.includes('URL');

      if (isPathOrNetError) {
        const profile: InspectorProfile = {
          id: `INSP-${Math.floor(1000 + Math.random() * 9000)}`,
          name: fullName.trim(),
          email: email.trim() || 'inspector@empresa.com',
          role: registeringAsPrimaryAdmin ? 'Administrador principal' : 'Inspector de Campo',
          terminal,
          department,
          avatarUrl,
          phone: phone.trim() || defaultInspector.phone,
          documentId: documentId.trim(),
          company: company.trim(),
          licenseNumber: licenseNumber.trim(),
          bloodType,
        };
        onAuthSuccess(profile, profile.email);
      } else {
        setErrorMsg(err?.message || 'Error al registrar la cuenta en Supabase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    onAuthSuccess(
      {
        ...defaultInspector,
        name: 'Ing. Carlos Mendoza',
        email: 'carlos.mendoza@redeselectricas.com',
        role: 'Inspector Senior de Redes MT/BT',
      },
      'carlos.mendoza@redeselectricas.com'
    );
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#eef5f7] p-4 font-['IBM_Plex_Sans'] sm:p-6 lg:p-8"
      style={{
        backgroundImage:
          'linear-gradient(rgba(23, 131, 184, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(23, 131, 184, 0.07) 1px, transparent 1px), radial-gradient(circle at 16% 16%, rgba(24, 170, 211, 0.12), transparent 28%), radial-gradient(circle at 84% 82%, rgba(120, 92, 160, 0.10), transparent 32%)',
        backgroundSize: '28px 28px, 28px 28px, auto, auto',
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
        <div className="absolute left-[8%] top-[14%] font-mono text-[10px] tracking-[0.2em] text-[#1783B8]/60">COORD. 04.6832 / -74.0886</div>
        <div className="absolute bottom-[13%] right-[9%] flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[#54636f]">
          <span className="h-px w-10 bg-[#1783B8]/50" /> CAPA DE PLANO ACTIVA
        </div>
      </div>
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[6px] border-2 border-[#0c4d77] bg-white shadow-[0_24px_60px_rgba(7,55,83,0.18)] animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="relative overflow-hidden bg-[#073f74] p-6 text-white sm:p-8">
          <div className="absolute inset-0 opacity-25" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(120deg, transparent 47%, rgba(103, 220, 255, 0.75) 48%, transparent 49%), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)', backgroundSize: '100% 100%, 24px 24px' }} />
          <div className="absolute inset-y-0 left-0 flex w-1 flex-col" aria-hidden="true"><span className="h-1/3 bg-cyan-300" /><span className="h-1/3 bg-amber-300" /><span className="h-1/3 bg-violet-300" /></div>
          <div className="absolute left-6 top-4 font-mono text-[9px] tracking-[0.2em] text-cyan-100/80">ESTACIÓN / PLANO 01</div>
          <div className="absolute right-6 top-4 font-mono text-[9px] tracking-[0.18em] text-cyan-100/70">ACCESO CONTROLADO</div>
          <div className="relative z-10 mt-5 flex flex-col items-start text-left">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center border border-cyan-100/45 bg-[#062f59] shadow-inner">
                <svg viewBox="0 0 64 64" className="h-16 w-16" aria-label="Símbolo modular de cámara, caja y tubería" role="img">
                <path d="M17 17H32M32 17L46 32M32 17L32 47" stroke="#8CE7FF" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="16" cy="17" r="8" fill="none" stroke="#E8FBFF" strokeWidth="3" />
                <circle cx="16" cy="17" r="2.5" fill="#E8FBFF" />
                <rect x="25" y="40" width="14" height="14" rx="1.5" fill="none" stroke="#FFC767" strokeWidth="3" />
                <path d="M46 32H57M53 27V37" stroke="#D9C8FF" strokeWidth="3" strokeLinecap="round" />
                <circle cx="46" cy="32" r="5" fill="#D9C8FF" />
              </svg>
              </div>
              <div className="relative border-l-2 border-cyan-400 bg-white/5 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(158,231,255,0.18)]">
                <p className="font-mono text-[10px] font-semibold tracking-[0.22em] text-cyan-100/75">CONTROL DE OBRA</p>
                <h1 className="mt-1 flex items-center gap-2 font-['Space_Grotesk'] text-[26px] font-bold tracking-[-0.04em] text-white sm:text-[31px]">
                  <span className="relative inline-flex shrink-0 items-center gap-1.5" aria-hidden="true">
                    <span className="flex h-5 items-center gap-1 border-y border-cyan-200/55 px-1"><i className="h-2 w-2 rounded-full border-2 border-cyan-200" /><i className="h-2 w-2 border-2 border-amber-300" /><i className="h-0.5 w-3 bg-violet-200" /></span>
                    <i className="h-px w-2 bg-cyan-300" />
                  </span>
                  <span className="relative inline-flex items-center whitespace-nowrap border-y border-cyan-200/25 px-1.5 py-0.5 text-cyan-100 after:absolute after:-bottom-1 after:left-1.5 after:h-px after:w-6 after:bg-cyan-300">TRACKING<span className="mx-1.5 h-4 w-px bg-amber-300/80" aria-hidden="true" /><span className="tracking-[0.08em] text-white">LA NUBIA</span></span>
                </h1>
                <div className="mt-2 flex items-center gap-2 font-mono text-[8px] font-bold tracking-[0.18em] text-cyan-100/75">
                  <span>TRK-01</span><span className="h-px w-5 bg-cyan-300/80" /><span className="text-amber-200">NODOS / 03</span><span className="h-px w-4 bg-violet-200/80" /><span>CAM · CAJA · TRAZADO</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-cyan-100/20 pt-2 font-mono text-[8px] font-bold tracking-[0.12em] text-cyan-50/85">
              <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> CIAN / CÁMARA</span>
              <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 bg-amber-300" /> ÁMBAR / CAJA</span>
              <span className="inline-flex items-center gap-1"><i className="h-0.5 w-2 bg-violet-200" /> VIOLETA / TUBERÍA</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#c2c6d4] bg-[#f3faff]">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-3.5 font-['Space_Grotesk'] font-bold text-[12px] tracking-[0.05em] uppercase text-center border-b-2 transition-all ${
              mode === 'signin'
                ? 'border-[#004d99] text-[#004d99] bg-white shadow-xs'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            Acceder al plano
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-3.5 font-['Space_Grotesk'] font-bold text-[12px] tracking-[0.05em] uppercase text-center border-b-2 transition-all ${
              mode === 'signup'
                ? 'border-[#004d99] text-[#004d99] bg-white shadow-xs'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            Crear credencial
          </button>
        </div>

        {/* Form Container */}
        <div className="relative max-h-[75vh] space-y-5 overflow-y-auto bg-[#f7fbfc] p-6 sm:p-8" style={{ backgroundImage: 'linear-gradient(rgba(23,131,184,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,131,184,0.035) 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
          <div className="absolute bottom-0 left-0 top-0 flex w-1 flex-col" aria-hidden="true"><span className="h-1/3 bg-cyan-300" /><span className="h-1/3 bg-amber-300" /><span className="h-1/3 bg-violet-300" /></div>
          <div className="relative flex items-center justify-between border-y border-[#9ebfcc] bg-white/80 px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#35566b]">
            <span className="absolute -left-2 top-1/2 h-3 w-1 -translate-y-1/2 bg-cyan-400" aria-hidden="true" />
            <span>{mode === 'signin' ? 'AUTORIZACIÓN ACTIVA · CREDENCIALES' : 'ALTA DE CREDENCIAL · INSPECCIÓN'}</span>
            <span className="text-[#004d99]">PLANO 01</span>
          </div>
          {errorMsg && (
            <div className="p-3.5 bg-[#ffdad6] text-[#93000a] text-[13px] rounded-xl border border-[#ffb4ab] flex items-center gap-2.5 animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-[#dcfce7] text-[#166534] text-[13px] rounded-xl border border-[#bbf7d0] flex items-center gap-2.5 animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[20px] shrink-0">check_circle</span>
              <span>{successMsg}</span>
            </div>
          )}

          {pendingConfirmationEmail && (
            <div className="flex flex-col gap-3 rounded-xl border border-[#b9d9e7] bg-[#eef9fd] p-3.5 text-[13px] text-[#17445a] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-[#006aa6]">mark_email_unread</span>
                <span>Confirma <strong>{pendingConfirmationEmail}</strong> para activar el acceso administrador.</span>
              </div>
              <button type="button" onClick={handleResendConfirmation} disabled={isResendingConfirmation} className="shrink-0 rounded-lg border border-[#87bdd6] bg-white px-3 py-2 text-xs font-bold text-[#004d99] transition-colors hover:bg-[#e6f6ff] disabled:cursor-wait disabled:opacity-60">
                {isResendingConfirmation ? 'Enviando…' : 'Reenviar enlace'}
              </button>
            </div>
          )}

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="relative space-y-3 border border-[#b9d1dc] bg-white/90 p-3 shadow-[0_8px_18px_rgba(13,75,111,0.06)]">
              <span className="absolute right-3 top-3 font-mono text-[8px] font-bold tracking-[0.14em] text-[#0566aa]">MODO ACTIVO</span>
              <div className="mr-24 flex items-center gap-2 border-b border-dashed border-[#b9d1dc] pb-2 font-mono text-[8px] font-bold tracking-[0.12em] text-[#527284]">
                <span className="flex h-4 w-4 items-center justify-center border border-cyan-400 text-[10px] text-cyan-700">01</span>
                <span>LECTURA DE CREDENCIAL</span><span className="h-px flex-1 bg-[#9ebfcc]" /><span className="text-[#0b5d8c]">EN ESPERA</span>
              </div>
              <div className="border-l-2 border-cyan-400 px-3 py-2">
                <label className="mb-1.5 flex items-center justify-between font-mono text-[10px] font-bold tracking-[0.12em] text-[#315c70]">
                  <span>IDENTIFICADOR DE ACCESO</span><span className="text-[8px] text-cyan-700">CANAL / CIAN</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727783] text-[20px]">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="inspector@empresa.com"
                    className="w-full border border-[#9ebfcc] bg-[#f3faff] py-3 pl-11 pr-4 font-['IBM_Plex_Sans'] text-[14px] text-[#071e27] placeholder-[#727783] outline-none transition-colors focus:border-[#004d99] focus:bg-white"
                  />
                </div>
              </div>

              <div className="border-l-2 border-violet-300 px-3 py-2">
                <label className="mb-1.5 flex items-center justify-between font-mono text-[10px] font-bold tracking-[0.12em] text-[#315c70]">
                  <span>CLAVE DE VERIFICACIÓN</span><span className="text-[8px] text-[#684b9b]">SELLO / VIOLETA</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727783] text-[20px]">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-[#9ebfcc] bg-[#f3faff] py-3 pl-11 pr-11 font-['IBM_Plex_Sans'] text-[14px] text-[#071e27] placeholder-[#727783] outline-none transition-colors focus:border-[#004d99] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#727783] hover:text-[#071e27] p-0.5"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 border border-[#003f74] bg-[#004d99] px-4 py-3.5 font-['Space_Grotesk'] text-[14px] font-bold tracking-[0.05em] text-white shadow-sm transition-all hover:bg-[#00468c] active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                    <span>Autenticando usuario...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">login</span>
                    <span>Abrir plano de inspección</span>
                  </>
                )}
              </button>
              <p className="border-t border-dashed border-[#b9d1dc] pt-2 text-center font-mono text-[9px] tracking-[0.12em] text-[#527284]">VALIDA CREDENCIAL Y CARGA EL CONTEXTO DEL PLANO</p>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Profile Photo Selector during Signup */}
              <div className="bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-3.5">
                <label className="block text-xs font-bold text-[#071e27] mb-2">
                  Foto de Identificación del Usuario
                </label>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#004d99] cursor-pointer group shrink-0"
                    title="Haz clic para subir foto"
                  >
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFile}
                  />

                  <div className="flex-1 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-[#004d99] text-white text-xs font-bold rounded-lg hover:bg-[#003870] flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">upload</span>
                      Subir Mi Foto
                    </button>
                    <div className="flex items-center gap-1.5 pt-1">
                      {AVATAR_OPTIONS.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatarUrl(url)}
                          className={`w-7 h-7 rounded-full overflow-hidden border transition-transform ${
                            avatarUrl === url ? 'border-[#004d99] scale-110 ring-2 ring-[#004d99]/40' : 'opacity-70'
                          }`}
                        >
                          <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#071e27] mb-1.5">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727783] text-[20px]">
                    badge
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Ing. Carlos Mendoza"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl pl-11 pr-4 py-2.5 text-[14px] text-[#071e27] placeholder-[#727783] focus:border-[#004d99] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#071e27] mb-1">
                    Documento ID (Cédula / DNI)
                  </label>
                  <input
                    type="text"
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                    placeholder="Ej. CC 1.094.882.140"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl px-3 py-2 text-[13px] text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[#071e27] mb-1">
                    Teléfono Móvil
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 315 482 9901"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl px-3 py-2 text-[13px] text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#071e27] mb-1.5">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727783] text-[20px]">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="inspector@empresa.com"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl pl-11 pr-4 py-2.5 text-[14px] text-[#071e27] placeholder-[#727783] focus:border-[#004d99] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#071e27] mb-1.5">
                  Contraseña *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727783] text-[20px]">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl pl-11 pr-11 py-2.5 text-[14px] text-[#071e27] placeholder-[#727783] focus:border-[#004d99] focus:bg-white focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#727783] hover:text-[#071e27] p-0.5"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#071e27] mb-1">
                    Empresa / Contratista
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl px-3 py-2 text-[13px] text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-[#071e27] mb-1">
                    Matrícula Prof. (CONTE/RETIE)
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Ej. MP-ELEC-8842"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl px-3 py-2 text-[13px] text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-[#071e27] mb-1">
                    Terminal Asignado
                  </label>
                  <input
                    type="text"
                    value={terminal}
                    onChange={(e) => setTerminal(e.target.value)}
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl px-3 py-2 text-[13px] text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>
                <div className={`rounded-xl border px-3 py-2 ${registeringAsPrimaryAdmin ? 'border-[#87bdd6] bg-[#e8f5fb]' : 'border-[#dce7eb] bg-[#f8fbfc]'}`}>
                  <p className="text-[11px] font-bold text-[#17313d]">Perfil de acceso</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-[#4e6572]">
                    {registeringAsPrimaryAdmin
                      ? 'Este correo se registrará como administrador principal.'
                      : 'Los nuevos usuarios se registran como inspectores; un administrador asignará sus módulos.'}
                  </p>
                </div>
              </div>

              {registeringAsPrimaryAdmin && (
                <div className="rounded-xl border border-[#b9d9e7] bg-[#eef9fd] px-3 py-2 text-[12px] text-[#17445a]">
                  Estás usando el correo administrador principal: <strong>{PRIMARY_ADMIN_EMAIL}</strong>.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-[#004d99] hover:bg-[#00468c] active:scale-[0.99] text-white font-['Inter'] font-bold text-[14px] rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                    <span>Registrando usuario...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    <span>Registrar e Ingresar</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Access Divider & Button */}
          <div className="pt-4 border-t border-[#c2c6d4] text-center">
            <p className="font-mono text-[10px] tracking-[0.08em] text-[#527284] mb-3">
              SIMULACIÓN CONTROLADA · CARGA CONTEXTO DE PLANO
            </p>
            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full py-2.5 px-4 bg-[#e6f6ff] hover:bg-[#cfe6f2] text-[#004d99] border border-[#004d99]/30 font-['Inter'] font-bold text-[13px] rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              <span>Explorar plano de demostración</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
