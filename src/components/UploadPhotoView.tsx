/**
 * Diseño: cartografía técnica sobria. Este formulario muestra únicamente las
 * propiedades propias del elemento activo para evitar registros híbridos.
 */
import React, { useState, useRef } from 'react';
import { InspectionPhoto, PhotoCategory, InspectorProfile, ExecutionStatus, CameraCode, CameraType, ElementType, getPipeNetworkOption, PIPE_NETWORK_OPTIONS, PipeNetworkType } from '../types';
import { WAREHOUSE_LOCATIONS, CAMERA_CODES, CAMERA_TYPES } from '../data/mockData';
import { compressImageForDevice } from '../services/deviceStorageService';
import { TramoSelector } from './TramoSelector';

interface UploadPhotoViewProps {
  onUploadSuccess: (newPhoto: InspectionPhoto) => void;
  onCancel: () => void;
  inspector: InspectorProfile;
  onOpenAuth?: () => void;
}

export const UploadPhotoView: React.FC<UploadPhotoViewProps> = ({
  onUploadSuccess,
  onCancel,
  inspector,
  onOpenAuth,
}) => {
  const [photoName, setPhotoName] = useState<string>('');
  const [category, setCategory] = useState<PhotoCategory>('inspection');
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('En proceso');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<string>('Bodega 1');
  const [cameraCode, setCameraCode] = useState<CameraCode>('SB850');
  const [cameraType, setCameraType] = useState<CameraType>('MT');
  const [elementType, setElementType] = useState<ElementType>('caja');
  const [tramo, setTramo] = useState<string>('3x4"');
  const [metraje, setMetraje] = useState<string>('12');
  const [pipeNetworkType, setPipeNetworkType] = useState<PipeNetworkType>('baja_tension');
  const [fieldNotes, setFieldNotes] = useState<string>('');
  const [requiresImmediateAction, setRequiresImmediateAction] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageSizeFormatted, setImageSizeFormatted] = useState<string>('1.2 MB');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, sube un archivo de imagen válido (JPG, PNG, WebP, HEIC).');
      return;
    }
    setErrorMessage(null);
    setIsProcessingImage(true);

    try {
      // Calculate formatted size
      const origSize = file.size;
      const sizeStr = origSize > 1024 * 1024 
        ? `${(origSize / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(origSize / 1024)} KB`;
      setImageSizeFormatted(sizeStr);

      // Compress and optimize for local storage on PC / mobile
      const compressedDataUrl = await compressImageForDevice(file);
      setPreviewImage(compressedDataUrl);

      if (!photoName) {
        const generatedName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setPhotoName(generatedName.charAt(0).toUpperCase() + generatedName.slice(1));
      }
    } catch (err) {
      console.error('Error processing image:', err);
      setErrorMessage('Ocurrió un error al procesar la imagen.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!previewImage) {
      setErrorMessage('Por favor, selecciona o captura una imagen de inspección.');
      return;
    }

    if (!photoName.trim()) {
      setErrorMessage('Por favor, ingresa un nombre para la foto de inspección.');
      return;
    }

    setIsSubmitting(true);

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const categoryLabels: Record<PhotoCategory, string> = {
      inspection: 'Inspección General',
      maintenance: 'Revisión de Mantenimiento',
      site_visit: 'Documentación de Obra',
      safety_hazard: 'Riesgo de Seguridad',
      structural: 'Integridad Estructural',
      electrical: 'Sistema Eléctrico',
    };

    const newPhoto: InspectionPhoto = {
      id: `photo-${Date.now()}`,
      displayId: `INSP-${new Date().getFullYear()}-${randomSuffix}`,
      name: photoName.trim(),
      imageUrl: previewImage,
      imageUrls: [previewImage],
      evidenceTimeline: [{ url: previewImage, capturedAt: new Date().toISOString() }],
      date: new Date(date).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) + `, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dateRaw: date,
      status: requiresImmediateAction ? 'Flagged' : 'Synced',
      executionStatus: executionStatus,
      category: category,
      categoryLabel: categoryLabels[category] || 'Inspección',
      location: location.trim() || 'Bodega 1',
      elementType,
      cameraCode: elementType === 'camara' ? cameraCode : undefined,
      cameraType: elementType === 'camara' ? cameraType : undefined,
      tramo: elementType === 'tuberia' ? tramo.trim() || undefined : undefined,
      metraje: elementType === 'tuberia' ? metraje.trim() || undefined : undefined,
      pipeNetworkType: elementType === 'tuberia' ? pipeNetworkType : undefined,
      pipeColor: elementType === 'tuberia' ? getPipeNetworkOption(pipeNetworkType).color : undefined,
      inspectorName: inspector.name,
      inspectorId: inspector.id,
      inspectorAvatar: inspector.avatarUrl,
      type: categoryLabels[category] || 'Análisis de Inspección',
      verified: !requiresImmediateAction && executionStatus === 'Terminado',
      fieldNotes: fieldNotes.trim() || 'Registrado en memoria local del dispositivo PhotoVault Pro.',
      requiresImmediateAction: requiresImmediateAction,
      fileSize: imageSizeFormatted,
      resolution: '1920 x 1080',
    };

    setTimeout(() => {
      setIsSubmitting(false);
      onUploadSuccess(newPhoto);
    }, 400);
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Header */}
      <header className="mb-8 border-b border-[#c2c6d4] pb-4">
        <h1 className="font-['Hanken_Grotesk'] text-2xl sm:text-[32px] font-bold text-[#004d99] leading-tight">
          Subir Foto
        </h1>
        <p className="font-['Inter'] text-[16px] text-[#424752] mt-2">
          Registra nuevas imágenes de inspección en campo y sus metadatos asociados.
        </p>
      </header>

      {/* Inspector Identification & Supabase Auth Banner */}
      <div className="mb-6 p-4 rounded-xl bg-white border border-[#c2c6d4] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={inspector.avatarUrl}
            alt={inspector.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-[#004d99]"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-['Hanken_Grotesk'] font-bold text-[16px] text-[#071e27]">
                {inspector.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#cfe6f2] text-[#004d99]">
                {inspector.id}
              </span>
            </div>
            <p className="font-['Inter'] text-[12px] text-[#424752]">
              {inspector.role} • {inspector.terminal} ({inspector.email})
            </p>
          </div>
        </div>

        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-3.5 py-1.5 rounded-lg border border-[#004d99] text-[#004d99] hover:bg-[#004d99] hover:text-white font-['Inter'] font-bold text-[12px] transition-all flex items-center gap-1.5 self-end sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]">switch_account</span>
            <span>Cambiar Inspector / Supabase Auth</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a] rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-[22px]">error</span>
          <span className="text-[14px] font-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* File Upload Area */}
        <div className="bg-white border-2 border-dashed border-[#004d99]/60 rounded-xl p-6 sm:p-8 text-center transition-all">
          {isProcessingImage ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <span className="material-symbols-outlined text-[40px] text-[#004d99] animate-spin">
                progress_activity
              </span>
              <p className="font-['Inter'] font-bold text-[14px] text-[#004d99]">
                Optimizando imagen para la memoria del dispositivo...
              </p>
            </div>
          ) : previewImage ? (
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-md h-60 rounded-lg overflow-hidden border border-[#c2c6d4] bg-[#cfe6f2] mb-3 shadow-xs">
                <img
                  src={previewImage}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImage(null);
                  }}
                  className="absolute top-2 right-2 bg-white/90 text-[#ba1a1a] p-1.5 rounded-full hover:bg-white shadow-xs"
                  title="Quitar imagen"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded">
                  {imageSizeFormatted} • Optimizada
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-[#004d99] text-[#004d99] text-[13px] font-bold hover:bg-[#e6f6ff] transition-colors"
                >
                  Cambiar archivo
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-[#004d99] text-white text-[13px] font-bold hover:bg-[#1565c0] transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  Tomar otra foto
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-[#e6f6ff] flex items-center justify-center text-[#004d99]">
                <span className="material-symbols-outlined text-[36px]">
                  add_a_photo
                </span>
              </div>
              <div>
                <p className="font-['Hanken_Grotesk'] font-bold text-lg text-[#071e27]">
                  Carga una foto de inspección
                </p>
                <p className="font-['Inter'] text-[14px] text-[#424752] mt-1">
                  Se guardará de forma segura en la memoria de este dispositivo (PC o celular)
                </p>
              </div>

              {/* Action buttons: Files or Camera */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-[#004d99] text-white font-['Inter'] font-bold text-[13px] hover:bg-[#1565c0] transition-all flex items-center gap-2 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                  <span>Elegir Archivo (PC / Móvil)</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-[#1b6d24] text-white font-['Inter'] font-bold text-[13px] hover:bg-[#155d1e] transition-all flex items-center gap-2 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  <span>Tomar Foto con Cámara</span>
                </button>
              </div>

              <p className="font-['Inter'] text-[12px] text-[#727783] pt-1">
                Formatos: JPG, PNG, WEBP, HEIC • Arrastra y suelta desde tu PC
              </p>
            </div>
          )}

          {/* Hidden inputs for PC and Mobile Camera */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Metadata Form Section */}
        <div className="bg-[#F5F7F8] p-6 rounded-xl border border-[#c2c6d4]">
          <h3 className="font-['Hanken_Grotesk'] font-bold text-xl text-[#071e27] mb-4">
            Detalles de la Foto
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Photo Name */}
            <div className="flex flex-col space-y-1 md:col-span-2">
              <label
                htmlFor="photoName"
                className="font-['Inter'] font-bold text-[14px] text-[#071e27]"
              >
                Nombre de la Foto
              </label>
              <input
                id="photoName"
                type="text"
                value={photoName}
                onChange={(e) => setPhotoName(e.target.value)}
                placeholder="Ej. Fuga en Válvula B - Terminal Norte"
                required
                className="w-full bg-white border border-[#c2c6d4] rounded-lg px-4 py-3 font-['Inter'] text-[14px] text-[#071e27] focus:border-[#004d99] focus:ring-1 focus:ring-[#004d99] outline-none transition-all"
              />
            </div>

            {/* Execution Status (Estado: En proceso / Terminado) */}
            <div className="flex flex-col space-y-1">
              <label className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                Estado de la Inspección
              </label>
              <div className="grid grid-cols-2 gap-2 h-[46px]">
                <button
                  type="button"
                  onClick={() => setExecutionStatus('En proceso')}
                  className={`rounded-lg border font-['Inter'] font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all ${
                    executionStatus === 'En proceso'
                      ? 'bg-[#f59e0b] text-white border-[#f59e0b] shadow-xs'
                      : 'bg-white text-[#424752] border-[#c2c6d4] hover:bg-[#e6f6ff]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                  En proceso
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionStatus('Terminado')}
                  className={`rounded-lg border font-['Inter'] font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all ${
                    executionStatus === 'Terminado'
                      ? 'bg-[#16a34a] text-white border-[#16a34a] shadow-xs'
                      : 'bg-white text-[#424752] border-[#c2c6d4] hover:bg-[#e6f6ff]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Terminado
                </button>
              </div>
            </div>

            {/* Category */}
            <div className="flex flex-col space-y-1">
              <label
                htmlFor="photoCategory"
                className="font-['Inter'] font-bold text-[14px] text-[#071e27]"
              >
                Categoría
              </label>
              <div className="relative">
                <select
                  id="photoCategory"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PhotoCategory)}
                  className="w-full bg-white border border-[#c2c6d4] rounded-lg pl-4 pr-10 py-3 font-['Inter'] text-[14px] text-[#071e27] appearance-none focus:border-[#004d99] focus:ring-1 focus:ring-[#004d99] outline-none transition-all"
                >
                  <option value="inspection">Inspección General</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="site_visit">Visita de Obra</option>
                  <option value="safety_hazard">Riesgo de Seguridad</option>
                  <option value="structural">Integridad Estructural</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#424752] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Date */}
            <div className="flex flex-col space-y-1">
              <label
                htmlFor="inspectionDate"
                className="font-['Inter'] font-bold text-[14px] text-[#071e27]"
              >
                Fecha
              </label>
              <input
                id="inspectionDate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-[#c2c6d4] rounded-lg pl-4 pr-4 py-3 font-['Inter'] text-[14px] text-[#071e27] focus:border-[#004d99] focus:ring-1 focus:ring-[#004d99] outline-none transition-all"
              />
            </div>

            {/* Location with Warehouse List (Bodega 1 ... Bodega 62) */}
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="location"
                  className="font-['Inter'] font-bold text-[14px] text-[#071e27]"
                >
                  Ubicación / Bodega
                </label>
                <span className="text-[11px] font-medium text-[#004d99]">
                  62 Bodegas disponibles
                </span>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#424752] text-[18px]">
                  warehouse
                </span>
                <input
                  id="location"
                  list="warehouse-locations-list"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Selecciona o escribe: Bodega 1, Bodega 2, ... Bodega 62"
                  className="w-full bg-white border border-[#c2c6d4] rounded-lg pl-10 pr-24 py-3 font-['Inter'] text-[14px] text-[#071e27] focus:border-[#004d99] focus:ring-1 focus:ring-[#004d99] outline-none transition-all"
                />
                {/* Quick Select Bodega Dropdown */}
                <select
                  aria-label="Seleccionar bodega rápida"
                  value={WAREHOUSE_LOCATIONS.includes(location) ? location : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setLocation(e.target.value);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#004d99] bg-[#cfe6f2]/50 hover:bg-[#cfe6f2] border border-[#004d99]/30 rounded px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="">Elegir Bodega...</option>
                  {WAREHOUSE_LOCATIONS.map((bodega) => (
                    <option key={bodega} value={bodega}>
                      {bodega}
                    </option>
                  ))}
                </select>
                <datalist id="warehouse-locations-list">
                  {WAREHOUSE_LOCATIONS.map((bodega) => (
                    <option key={bodega} value={bodega} />
                  ))}
                  <option value="Terminal A-12, Sector 4" />
                  <option value="Refinería Norte, Línea de Vapor 04" />
                  <option value="Zona Comercial Ala Este, Grúa 02" />
                  <option value="Subestación 3B, Distribución Principal" />
                </datalist>
              </div>
            </div>

            {/* El tipo determina la capa y las propiedades que el usuario puede editar. */}
            <div className="md:col-span-2 rounded-xl border border-[#c2c6d4] bg-[#f8fbfd] p-3.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="font-['Inter'] font-bold text-[14px] text-[#071e27]">Elemento que se agregará al plano</label>
                <span className="text-[11px] font-medium text-[#004d99]">Propiedades independientes</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([
                  ['caja', 'Caja', 'inventory_2', 'bg-amber-500'],
                  ['camara', 'Cámara', 'videocam', 'bg-sky-600'],
                  ['tuberia', 'Tubería', 'timeline', 'bg-violet-600'],
                ] as const).map(([value, label, icon, activeClass]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setElementType(value)}
                    aria-pressed={elementType === value}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 font-['Inter'] text-[13px] font-bold transition-all active:scale-[0.97] ${
                      elementType === value
                        ? `${activeClass} border-transparent text-white shadow-sm`
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:border-[#004d99] hover:bg-[#f3faff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {elementType === 'camara' && (
              <>
            {/* Camera Code Selection (SB850, SB851, SB858) */}
            <div className="flex flex-col space-y-1">
              <label className="font-['Inter'] font-bold text-[14px] text-[#071e27] flex items-center justify-between">
                <span>Código / Tipo de Cámara</span>
                <span className="text-[11px] font-medium text-[#004d99]">Modelos SB</span>
              </label>
              <div className="grid grid-cols-3 gap-2 h-[46px]">
                {CAMERA_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setCameraCode(code)}
                    className={`rounded-lg border font-['Inter'] font-bold text-[13px] flex items-center justify-center gap-1 transition-all ${
                      cameraCode === code
                        ? 'bg-[#004d99] text-white border-[#004d99] shadow-xs'
                        : 'bg-white text-[#424752] border-[#c2c6d4] hover:bg-[#f3faff] hover:border-[#004d99]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">videocam</span>
                    {code}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera System Type (MT, BT, Datos) */}
            <div className="flex flex-col space-y-1">
              <label className="font-['Inter'] font-bold text-[14px] text-[#071e27] flex items-center justify-between">
                <span>Tipo de Red / Sistema</span>
                <span className="text-[11px] font-medium text-[#004d99]">MT / BT / Datos</span>
              </label>
              <div className="grid grid-cols-3 gap-2 h-[46px]">
                {CAMERA_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCameraType(type)}
                    className={`rounded-lg border font-['Inter'] font-bold text-[13px] flex items-center justify-center gap-1 transition-all ${
                      cameraType === type
                        ? type === 'MT'
                          ? 'bg-[#0284c7] text-white border-[#0284c7] shadow-xs'
                          : type === 'BT'
                          ? 'bg-[#059669] text-white border-[#059669] shadow-xs'
                          : 'bg-[#7c3aed] text-white border-[#7c3aed] shadow-xs'
                        : 'bg-white text-[#424752] border-[#c2c6d4] hover:bg-[#f3faff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {type === 'MT' ? 'bolt' : type === 'BT' ? 'electric_bolt' : 'lan'}
                    </span>
                    {type}
                  </button>
                ))}
              </div>
            </div>

              </>
            )}
            {elementType === 'tuberia' && (
              <>
            <div className="md:col-span-2 rounded-xl border border-[#b7d5e4] bg-[#f4fbfe] p-3.5">
              <p className="font-['Inter'] text-[12px] font-bold text-[#173f58]">Tipo de red del tramo</p>
              <p className="mt-0.5 text-[11px] text-[#607d8b]">Al guardar, el tramo adopta el color asignado a su red en el plano.</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {PIPE_NETWORK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPipeNetworkType(option.value)}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 border px-2 text-[11px] font-bold transition ${
                      pipeNetworkType === option.value
                        ? 'border-[#073f74] bg-white text-[#073f74] ring-2 ring-cyan-200'
                        : 'border-[#c2dbe7] bg-white text-[#547181] hover:bg-[#eaf6fb]'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Tramo de Tubería y Metraje (Cantidad x Dimensión + Metros Lineales) */}
            <div className="md:col-span-2">
              <TramoSelector
                tramo={tramo}
                onTramoChange={setTramo}
                metraje={metraje}
                onMetrajeChange={setMetraje}
                maxQuantity={pipeNetworkType === 'baja_tension' ? 21 : 24}
                label="Propiedades de Tramo y Metraje de Tubería (4&quot;, 6&quot;, etc.)"
              />
            </div>

              </>
            )}
            {/* Ubicación manual en el plano */}
            <div className="md:col-span-2 p-3.5 bg-[#e6f6ff] border border-[#004d99]/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#004d99] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">ads_click</span>
                </div>
                <div>
                  <div className="font-bold text-[13px] text-[#071e27] flex items-center gap-1.5">
                    <span>Ubicación manual en el plano JPG</span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">
                      Pendiente
                    </span>
                  </div>
                  <div className="text-[12px] text-[#424752] mt-0.5">
                    Después de guardar, abre el plano y elige el punto exacto del elemento. Las tuberías se trazan con un punto inicial y uno final.
                  </div>
                </div>
              </div>
            </div>

            {/* Field Notes */}
            <div className="flex flex-col space-y-1 md:col-span-2">
              <label
                htmlFor="fieldNotes"
                className="font-['Inter'] font-bold text-[14px] text-[#071e27]"
              >
                Notas de Campo y Observaciones
              </label>
              <textarea
                id="fieldNotes"
                rows={3}
                value={fieldNotes}
                onChange={(e) => setFieldNotes(e.target.value)}
                placeholder="Añade observaciones, notas de integridad estructural, lecturas de manómetros..."
                className="w-full bg-white border border-[#c2c6d4] rounded-lg p-3 font-['Inter'] text-[14px] text-[#071e27] focus:border-[#004d99] focus:ring-1 focus:ring-[#004d99] outline-none transition-all"
              />
            </div>

            {/* Immediate Action Flag */}
            <div className="flex items-center gap-3 md:col-span-2 pt-2">
              <input
                id="actionReq"
                type="checkbox"
                checked={requiresImmediateAction}
                onChange={(e) => setRequiresImmediateAction(e.target.checked)}
                className="w-5 h-5 text-[#ba1a1a] rounded border-[#c2c6d4] focus:ring-[#ba1a1a]"
              />
              <label htmlFor="actionReq" className="text-[14px] text-[#071e27] cursor-pointer">
                <strong>Requiere Acción Inmediata / Marcar como Riesgo de Seguridad</strong>
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-4 border-t border-[#c2c6d4]">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 font-['Inter'] font-bold text-[14px] text-[#424752] border border-[#c2c6d4] rounded-lg hover:bg-[#cfe6f2] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-[#004d99] text-white font-['Inter'] font-bold text-[14px] rounded-lg hover:bg-[#00468c] transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Subiendo...
              </>
            ) : (
              'Subir Foto'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
