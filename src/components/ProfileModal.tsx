import React, { useState, useRef } from 'react';
import { InspectorProfile } from '../types';

interface ProfileModalProps {
  inspector: InspectorProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: InspectorProfile) => void;
}

const AVATAR_OPTIONS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDiDBbLLvg2B5k0M06HZaqqowCMmsx43C7fxTCQaVlaJESX35l_Zm_vvaVMHFW4cKQB4PBFEPQjmy9pmvbTElsz9c6-g_dokmoFe-j8qcIehL-VdSKN5BdaJw4j_dhYqqMe5cIkr9ygYoZ7kwM9AV-b2nTUJCgy9R0iLKi17lAdIPFmbjb0XdEa6BNI6wz_m8jGCGdKWJ71ATrWcI6mskw58SqOO4HhrjAsRB0AXdmBhkZhGPeYt0uL',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBLct-mcOO8oUrLsDHGt-X85lwC_UOjvDkeo8E3zrns8Ewq63d1OKsFDJkXOeXVmkULhIQxMQOuSruq4sqtZ76Y_9dtgiJg_8NPSQ1oaR3LNBmyU0a1g5LU5nHqBWPBEAyfZXD2J_3jIMXM0-AcZgYv-vzuHJ88iomH8SbVd-ekvPT8760UN2X8qwyFBdVW3g8rg-pk08T230cofMKQsv-s8qAMlWOVaIGFbwqC1-W5EmgOx3pzEP_G',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCDnFWPNGSYOLqVupc5YdYJt21nDuD6yTY9Ez8Zq1u5NkHepgtnAsucBlPoWnteF0lyXeGDGAIAAl6dMaLmjhoZGn7tWaC-UXw2D1ZHtcoutN0iyHR71-Fn7Uyl8ylYfJnUalNFw3a_jn_WKDT-MP5KXERnCJe2Xt7xKfUNNtiRO-ZesLCAzk1deNozabpoMA7l51uNyNKdw-3Z8Kjj-YUhVCoruiqINdxR6JQIPAoe4vRgBs4tnGK-',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBrCVp0754qvCMfbDye_Gdn3X5wIGxd-ZT0yib9F-awmwuRKd6IUcWB_RTHr3neCS5Wu1o-Rmz6mPEfHOt6AQJ6kSlYrGylV8H_rEl-SzVun3xDrWEXT--z__ZMznDDWWIOPMbEP85upKzxU_bE2R-tK31k5gXxW6Kq9T-v5sRFLRtnk3-rKU_2KX2ey77mpITzYBx3xugPaoEIup4OiqJCREhslk8lmw9AusK9LnWWAgY1JiqZY_h-',
];

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  inspector,
  isOpen,
  onClose,
  onSave,
}) => {
  // Tab Navigation
  const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'work' | 'badge'>('personal');

  // Form Fields
  const [name, setName] = useState(inspector.name || '');
  const [documentId, setDocumentId] = useState(inspector.documentId || '');
  const [birthDate, setBirthDate] = useState(inspector.birthDate || '');
  const [gender, setGender] = useState(inspector.gender || 'Masculino');
  const [city, setCity] = useState(inspector.city || '');
  const [address, setAddress] = useState(inspector.address || '');

  // Contact & Emergency
  const [email, setEmail] = useState(inspector.email || '');
  const [phone, setPhone] = useState(inspector.phone || '');
  const [emergencyContactName, setEmergencyContactName] = useState(inspector.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(inspector.emergencyContactPhone || '');
  const [bloodType, setBloodType] = useState(inspector.bloodType || 'O+');
  const [notes, setNotes] = useState(inspector.notes || '');

  // Work & Credentials
  const [role, setRole] = useState(inspector.role || '');
  const [company, setCompany] = useState(inspector.company || 'Consorcio Eléctrico de Occidente');
  const [licenseNumber, setLicenseNumber] = useState(inspector.licenseNumber || '');
  const [id, setId] = useState(inspector.id || '');
  const [terminal, setTerminal] = useState(inspector.terminal || '');
  const [department, setDepartment] = useState(inspector.department || 'Operaciones de Campo');

  // Avatar / Photo State
  const [avatarUrl, setAvatarUrl] = useState(inspector.avatarUrl || AVATAR_OPTIONS[0]);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Process and optimize uploaded image via canvas
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setPhotoFeedback('El archivo seleccionado no es una imagen válida.');
      return;
    }

    setIsProcessingPhoto(true);
    setPhotoFeedback(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 512;
          const width = img.width;
          const height = img.height;

          // Square center crop calculation
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          canvas.width = Math.min(minDim, maxDim);
          canvas.height = Math.min(minDim, maxDim);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              img,
              startX,
              startY,
              minDim,
              minDim,
              0,
              0,
              canvas.width,
              canvas.height
            );
            const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
            setAvatarUrl(optimizedDataUrl);
            setPhotoFeedback('¡Foto del usuario actualizada con éxito!');
            setTimeout(() => setPhotoFeedback(null), 4000);
          }
        } catch (err) {
          console.warn('Canvas optimization fallback:', err);
          setAvatarUrl(e.target?.result as string);
          setPhotoFeedback('¡Foto del usuario cargada!');
        } finally {
          setIsProcessingPhoto(false);
        }
      };
      img.onerror = () => {
        setIsProcessingPhoto(false);
        setPhotoFeedback('No se pudo procesar la imagen seleccionada.');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleApplyCustomUrl = () => {
    if (customUrlInput.trim()) {
      setAvatarUrl(customUrlInput.trim());
      setPhotoFeedback('Enlace de foto aplicado.');
      setShowUrlInput(false);
      setCustomUrlInput('');
      setTimeout(() => setPhotoFeedback(null), 3000);
    }
  };

  const isCustomPhoto = !AVATAR_OPTIONS.includes(avatarUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...inspector,
      name: name.trim() || inspector.name,
      documentId: documentId.trim(),
      birthDate,
      gender,
      city: city.trim(),
      address: address.trim(),
      email: email.trim() || inspector.email,
      phone: phone.trim() || inspector.phone,
      emergencyContactName: emergencyContactName.trim(),
      emergencyContactPhone: emergencyContactPhone.trim(),
      bloodType,
      notes: notes.trim(),
      role: role.trim() || inspector.role,
      company: company.trim(),
      licenseNumber: licenseNumber.trim(),
      id: id.trim() || inspector.id,
      terminal: terminal.trim() || inspector.terminal,
      department: department.trim() || inspector.department,
      avatarUrl,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-[#c2c6d4] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-[#004d99] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-white text-[24px]">manage_accounts</span>
            </div>
            <div>
              <h3 className="font-['Hanken_Grotesk'] font-bold text-lg sm:text-xl text-white leading-tight">
                Personalización de Usuario e Inspector
              </h3>
              <p className="text-xs text-white/80 font-['Inter']">
                Administra tu foto de perfil, datos personales básicos, contacto de emergencia y matrícula técnica
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar ventana"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#c2c6d4] bg-[#f3faff] overflow-x-auto text-xs font-['Inter'] font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`px-4 py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'personal'
                ? 'border-[#004d99] text-[#004d99] bg-white'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">person</span>
            <span>Datos Personales</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`px-4 py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'contact'
                ? 'border-[#004d99] text-[#004d99] bg-white'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">contacts</span>
            <span>Contacto y Emergencia</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('work')}
            className={`px-4 py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'work'
                ? 'border-[#004d99] text-[#004d99] bg-white'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">engineering</span>
            <span>Datos Laborales & Matrícula</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('badge')}
            className={`px-4 py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'badge'
                ? 'border-[#004d99] text-[#004d99] bg-white'
                : 'border-transparent text-[#424752] hover:text-[#004d99]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">badge</span>
            <span>Carnet Digital</span>
          </button>
        </div>

        {/* Hidden File Inputs for photo upload and camera */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* PHOTO / AVATAR GLOBAL SECTION (Always Visible on Top of Editor) */}
          <div className="bg-[#f3faff] border border-[#c2c6d4] rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="font-['Inter'] font-bold text-xs sm:text-sm text-[#071e27] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#004d99] text-[20px]">account_circle</span>
                Fotografía Oficial del Usuario / Inspector
              </label>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isCustomPhoto
                    ? 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]'
                    : 'bg-[#e0e7ff] text-[#3730a3] border-[#c7d2fe]'
                }`}
              >
                {isCustomPhoto ? 'Foto Personalizada' : 'Avatar del Sistema'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Photo Preview Circle with Drag & Drop */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-24 h-24 sm:w-26 sm:h-26 rounded-full overflow-hidden border-4 cursor-pointer group shrink-0 transition-all shadow-sm ${
                  isDragging
                    ? 'border-[#004d99] ring-4 ring-[#004d99]/30 scale-105'
                    : 'border-[#004d99] hover:ring-4 hover:ring-[#004d99]/20'
                }`}
                title="Haz clic para seleccionar foto o arrastra un archivo aquí"
              >
                <img
                  src={avatarUrl}
                  alt={name || 'Usuario'}
                  className="w-full h-full object-cover"
                />

                {/* Hover overlay with camera icon */}
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                  <span className="text-[10px] font-bold mt-0.5">Cambiar Foto</span>
                </div>

                {isProcessingPhoto && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <span className="material-symbols-outlined animate-spin text-[#004d99]">sync</span>
                  </div>
                )}
              </div>

              {/* Action Buttons for Custom Photo */}
              <div className="flex-1 w-full flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#004d99] hover:bg-[#003870] text-white font-['Inter'] font-bold text-xs rounded-xl transition-colors shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                    <span>Subir Mi Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-[#e6f6ff] text-[#004d99] border border-[#004d99]/40 font-['Inter'] font-bold text-xs rounded-xl transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    <span>Tomar Foto</span>
                  </button>
                </div>

                {/* Secondary Photo Options */}
                <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-[#004d99] font-semibold hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">link</span>
                    <span>{showUrlInput ? 'Ocultar enlace' : 'Pegar URL de foto'}</span>
                  </button>

                  {isCustomPhoto && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(AVATAR_OPTIONS[0])}
                      className="text-[#727783] hover:text-[#ba1a1a] font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      <span>Restablecer</span>
                    </button>
                  )}
                </div>

                {/* Optional URL Input */}
                {showUrlInput && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="url"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="https://ejemplo.com/mifoto.jpg"
                      className="flex-1 bg-white border border-[#c2c6d4] rounded-lg px-2.5 py-1.5 text-xs text-[#071e27] focus:border-[#004d99] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomUrl}
                      className="px-3 py-1.5 bg-[#004d99] text-white font-bold text-xs rounded-lg hover:bg-[#003870]"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Photo Feedback Message */}
            {photoFeedback && (
              <div className="mt-2.5 p-2 bg-[#dcfce7] border border-[#86efac] text-[#166534] rounded-lg text-xs font-medium flex items-center gap-1.5 animate-in fade-in">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{photoFeedback}</span>
              </div>
            )}

            {/* Default Preset Avatars */}
            <div className="mt-3 pt-3 border-t border-[#c2c6d4]/60">
              <div className="text-[11px] font-semibold text-[#727783] mb-1.5">
                O selecciona uno de los avatares predeterminados:
              </div>
              <div className="flex items-center gap-2.5">
                {AVATAR_OPTIONS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(url);
                      setPhotoFeedback('Avatar del sistema seleccionado.');
                      setTimeout(() => setPhotoFeedback(null), 3000);
                    }}
                    className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all ${
                      avatarUrl === url
                        ? 'border-[#004d99] ring-2 ring-[#004d99]/40 scale-110 shadow-xs'
                        : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    title={`Avatar predeterminado ${i + 1}`}
                  >
                    <img src={url} alt={`Opción ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TAB 1: DATOS PERSONALES */}
          {activeTab === 'personal' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Ing. Carlos Mendoza"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Documento de Identidad (Cédula / DNI / RUT)
                  </label>
                  <input
                    type="text"
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                    placeholder="Ej. CC 1.094.882.140"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Género
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro / Prefiero no especificar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Ciudad / Municipio Base
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej. Bogotá D.C. / Medellín"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Dirección de Residencia
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej. Calle 127 # 45-20, Torre 2"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACTO Y EMERGENCIA */}
          {activeTab === 'contact' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="inspector@empresa.com"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Teléfono Móvil / WhatsApp de Campo
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 315 482 9901"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Safety / Emergency Highlight Box */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <span className="material-symbols-outlined text-[18px] text-amber-700">emergency</span>
                  <span>Seguridad Industrial en Obra y Contacto de Emergencia</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-['Inter'] font-bold text-[11px] text-amber-950 mb-1">
                      Grupo Sanguíneo (RH)
                    </label>
                    <select
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs text-amber-950 font-bold focus:outline-none"
                    >
                      {BLOOD_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-['Inter'] font-bold text-[11px] text-amber-950 mb-1">
                      Nombre Contacto de Emergencia & Parentesco
                    </label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="Ej. Laura Mendoza (Esposa)"
                      className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs text-amber-950 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-['Inter'] font-bold text-[11px] text-amber-950 mb-1">
                    Teléfono del Contacto de Emergencia
                  </label>
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="+57 318 902 3341"
                    className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs text-amber-950 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                  Alergias o Condiciones Médicas Relevantes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Alérgico a la Penicilina, vacunas de obra al día, usa lentes de contacto..."
                  className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs text-[#071e27] focus:border-[#004d99] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: DATOS LABORALES & MATRÍCULA */}
          {activeTab === 'work' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Cargo / Rol en Obra *
                  </label>
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Ej. Inspector Senior de Redes MT/BT"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Empresa / Consorcio Contratista
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ej. Consorcio Eléctrico de Occidente"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Matrícula Profesional / Licencia Técnica (CONTE / RETIE)
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Ej. MP-ELEC-2015-8842"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Placa / N° de Carnet Interno
                  </label>
                  <input
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="Ej. INSP-8842"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Terminal o Zona Asignada
                  </label>
                  <input
                    type="text"
                    value={terminal}
                    onChange={(e) => setTerminal(e.target.value)}
                    placeholder="Ej. Terminal A-12 (Zona Norte)"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] font-bold text-xs text-[#071e27] mb-1">
                    Departamento / Área
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ej. Supervisión de Obra y Calidad"
                    className="w-full bg-[#f3faff] border border-[#c2c6d4] rounded-xl p-2.5 text-xs sm:text-sm text-[#071e27] focus:border-[#004d99] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CARNET DIGITAL DE IDENTIFICACIÓN */}
          {activeTab === 'badge' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-xs text-[#727783] font-['Inter'] text-center">
                Previsualización de credencial de campo para inspecciones de redes eléctricas y canalizaciones
              </div>

              {/* ID Badge Card */}
              <div className="max-w-md mx-auto bg-gradient-to-br from-slate-900 via-[#071e27] to-[#004d99] text-white rounded-2xl p-5 shadow-xl border border-white/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Badge Top Header */}
                <div className="flex items-center justify-between border-b border-white/20 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                      <span className="material-symbols-outlined text-[18px]">verified_user</span>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-widest text-white/70 font-mono">
                        PhotoVault Obra Pro
                      </div>
                      <div className="text-xs font-bold font-['Hanken_Grotesk'] text-white">
                        {company || 'Consorcio Eléctrico'}
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                    ACTIVO
                  </span>
                </div>

                {/* Badge Body */}
                <div className="flex items-center gap-4 py-4">
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="w-20 h-20 rounded-xl object-cover border-2 border-white/40 shadow-md shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="text-base font-bold font-['Hanken_Grotesk'] text-white leading-tight">
                      {name || 'Nombre del Inspector'}
                    </div>
                    <div className="text-xs text-blue-200 font-medium">{role || 'Inspector de Obra'}</div>
                    <div className="text-[11px] text-white/70 font-mono flex items-center gap-2 pt-0.5">
                      <span>ID: {id || 'INSP-8842'}</span>
                      {documentId && (
                        <>
                          <span>•</span>
                          <span>{documentId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badge Footer Info */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/20 text-[10px] text-white/80 font-['Inter']">
                  <div>
                    <span className="text-white/50 block">GRUPO RH:</span>
                    <span className="font-bold text-amber-300 font-mono">{bloodType || 'O+'}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block">TERMINAL:</span>
                    <span className="font-bold truncate block">{terminal || 'A-12'}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block">MATRÍCULA:</span>
                    <span className="font-bold truncate block font-mono">{licenseNumber || 'RETIE'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#c2c6d4]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[#c2c6d4] hover:bg-slate-100 text-[#424752] font-['Inter'] font-bold text-xs sm:text-sm rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#004d99] hover:bg-[#003870] text-white font-['Inter'] font-bold text-xs sm:text-sm rounded-xl shadow-xs active:scale-98 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Guardar Datos de Usuario</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
