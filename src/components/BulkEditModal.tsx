/**
 * Modal de Ajuste Grupal / Edición por Lote para elementos del plano.
 * Permite seleccionar y aplicar masivamente: avance/estado de ejecución,
 * asignación de acta, ítems de acta de obra, rótulo en plano, tipo de red/cable,
 * notas de campo y verificación técnica.
 */
import React, { useMemo, useState } from 'react';
import {
  ActaItem,
  ActaLabelPosition,
  CableGauge,
  CableType,
  CABLE_GAUGE_OPTIONS,
  CABLE_TYPE_OPTIONS,
  ExecutionStatus,
  getElementType,
  getPhotoProgressPercentage,
  getPipeNetworkOption,
  InspectionPhoto,
  isCable,
  PIPE_NETWORK_OPTIONS,
  PipeNetworkType,
} from '../types';
import { ACTA_ITEM_OPTIONS, getActaItemKey } from '../data/actaItems';

const ACTAS_STORAGE_KEY = 'photovault_actas_catalog';
const DEFAULT_ACTAS = Array.from({ length: 10 }, (_, index) => `Acta ${index + 1}`);

const loadActas = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTAS_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return DEFAULT_ACTAS;
    const customActas = saved
      .filter((acta): acta is string => typeof acta === 'string' && acta.trim().length > 0)
      .map((acta) => acta.trim());
    return Array.from(new Set([...DEFAULT_ACTAS, ...customActas]));
  } catch {
    return DEFAULT_ACTAS;
  }
};

const ACTA_ITEMS_BY_SECTION = ACTA_ITEM_OPTIONS.reduce<Record<string, typeof ACTA_ITEM_OPTIONS[number][]>>((groups, item) => {
  (groups[item.section] ||= []).push(item);
  return groups;
}, {});

interface BulkEditModalProps {
  photos: InspectionPhoto[];
  isOpen: boolean;
  isAdmin: boolean;
  canAssignActa?: boolean;
  onClose: () => void;
  onSave: (updatedPhotos: InspectionPhoto[], summaryMessage: string) => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  photos,
  isOpen,
  isAdmin,
  canAssignActa = false,
  onClose,
  onSave,
}) => {
  // --- Modifiers Toggles (Only checked sections will be applied) ---
  const [applyProgress, setApplyProgress] = useState(true);
  const [applyActa, setApplyActa] = useState(false);
  const [applyActaItems, setApplyActaItems] = useState(false);
  const [applyActaLabelDisplay, setApplyActaLabelDisplay] = useState(false);
  const [applyNetworkOrCable, setApplyNetworkOrCable] = useState(false);
  const [applyNotes, setApplyNotes] = useState(false);
  const [applyVerification, setApplyVerification] = useState(false);

  // --- Values for Execution Status & Progress ---
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('En proceso');
  const [progressPercentage, setProgressPercentage] = useState<number>(50);

  // --- Values for Acta ---
  const [actas, setActas] = useState<string[]>(loadActas);
  const [selectedActa, setSelectedActa] = useState<string>(actas[0] || 'Acta 1');
  const [isClearingActa, setIsClearingActa] = useState(false);
  const [newActaInput, setNewActaInput] = useState('');
  const [actaNotice, setActaNotice] = useState<string | null>(null);

  // --- Values for Acta Label Display & Position ---
  const [showActaLabel, setShowActaLabel] = useState<boolean>(true);
  const [actaLabelPosition, setActaLabelPosition] = useState<ActaLabelPosition>('arriba');

  // --- Values for Acta Items ---
  const [actaItemsMode, setActaItemsMode] = useState<'replace' | 'append' | 'clear'>('replace');
  const [selectedActaItemKeys, setSelectedActaItemKeys] = useState<string[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // --- Values for Network / Cable (Pipes & Cables) ---
  const [pipeNetworkType, setPipeNetworkType] = useState<PipeNetworkType>('baja_tension');
  const [cableType, setCableType] = useState<CableType>('baja_tension');
  const [cableGauge, setCableGauge] = useState<CableGauge>('2');

  // --- Values for Verification ---
  const [verified, setVerified] = useState<boolean>(true);
  const [requiresImmediateAction, setRequiresImmediateAction] = useState<boolean>(false);

  // --- Values for Notes ---
  const [notesMode, setNotesMode] = useState<'append' | 'replace'>('append');
  const [fieldNotes, setFieldNotes] = useState('');

  // Counts by type
  const counts = useMemo(() => {
    let cameras = 0;
    let pipes = 0;
    let cables = 0;
    let electrical = 0;
    let boxes = 0;

    photos.forEach((photo) => {
      const type = getElementType(photo);
      if (type === 'camara') cameras++;
      else if (type === 'tuberia') pipes++;
      else if (isCable(photo)) cables++;
      else if (type === 'electrico') electrical++;
      else boxes++;
    });

    return { cameras, pipes, cables, electrical, boxes, total: photos.length };
  }, [photos]);

  // Filtered acta items based on search query
  const filteredActaItems = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    if (!q) return ACTA_ITEM_OPTIONS.slice(0, 40);
    return ACTA_ITEM_OPTIONS.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [itemSearchQuery]);

  const handleStatusChange = (status: ExecutionStatus) => {
    setExecutionStatus(status);
    if (status === 'Terminado') {
      setProgressPercentage(100);
    } else if (status === 'No iniciado') {
      setProgressPercentage(0);
    } else if (status === 'En proceso') {
      if (progressPercentage === 0 || progressPercentage === 100) {
        setProgressPercentage(50);
      }
    }
  };

  const handleProgressChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setProgressPercentage(clamped);
    if (clamped === 100) {
      setExecutionStatus('Terminado');
    } else if (clamped === 0) {
      setExecutionStatus('No iniciado');
    } else {
      setExecutionStatus('En proceso');
    }
  };

  const handleAddNewActa = () => {
    const trimmed = newActaInput.trim();
    if (!trimmed) {
      setActaNotice('Escribe el nombre o número del acta para agregarla.');
      return;
    }
    const existing = actas.find((a) => a.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setSelectedActa(existing);
      setIsClearingActa(false);
      setNewActaInput('');
      setActaNotice(`"${existing}" ya estaba disponible y ha sido seleccionada.`);
      return;
    }

    const updated = [...actas, trimmed];
    setActas(updated);
    setSelectedActa(trimmed);
    setIsClearingActa(false);
    setNewActaInput('');
    setActaNotice(`"${trimmed}" fue creada y seleccionada.`);
    try {
      localStorage.setItem(ACTAS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignorar errores de almacenamiento local
    }
  };

  const toggleActaItem = (key: string) => {
    setSelectedActaItemKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const hasAnyChangeSelected =
    applyProgress ||
    applyActa ||
    applyActaItems ||
    applyActaLabelDisplay ||
    applyNetworkOrCable ||
    applyNotes ||
    applyVerification;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photos.length || !hasAnyChangeSelected) return;

    const chosenActaItems: ActaItem[] = selectedActaItemKeys
      .map((k) => ACTA_ITEM_OPTIONS.find((item) => getActaItemKey(item) === k))
      .filter((item): item is ActaItem => Boolean(item));

    const summaryParts: string[] = [];

    if (applyProgress) {
      summaryParts.push(`Avance al ${progressPercentage}% (${executionStatus})`);
    }
    if (applyActa) {
      summaryParts.push(isClearingActa ? 'Acta removida' : `Acta: ${selectedActa}`);
    }
    if (applyActaItems) {
      summaryParts.push(
        actaItemsMode === 'clear'
          ? 'Ítems de acta eliminados'
          : `${chosenActaItems.length} ítem(s) de acta asignados`
      );
    }
    if (applyNetworkOrCable) {
      summaryParts.push('Red/Cable actualizado');
    }
    if (applyVerification) {
      summaryParts.push(verified ? 'Verificado' : 'No verificado');
    }

    const updatedPhotos = photos.map((original) => {
      const type = getElementType(original);
      const isCableElement = isCable(original);

      // Clone
      const updated: InspectionPhoto = { ...original };

      // 1. Progress & Execution Status
      if (applyProgress) {
        updated.executionStatus = executionStatus;
        updated.progressPercentage = progressPercentage;
        if (executionStatus === 'Terminado') {
          updated.status = 'Synced';
        }
      }

      // 2. Acta
      if (applyActa && (isAdmin || canAssignActa)) {
        updated.acta = isClearingActa ? undefined : selectedActa;
      }

      // 3. Acta Label Display & Position
      if (applyActaLabelDisplay) {
        updated.showActaLabel = showActaLabel;
        updated.actaLabelPosition = actaLabelPosition;
      }

      // 4. Acta Items
      if (applyActaItems && (isAdmin || canAssignActa)) {
        if (actaItemsMode === 'clear') {
          updated.actaItem = undefined;
          updated.actaItems = [];
        } else if (actaItemsMode === 'replace') {
          updated.actaItems = chosenActaItems;
          updated.actaItem = chosenActaItems[0];
        } else if (actaItemsMode === 'append') {
          const currentItems = updated.actaItems || (updated.actaItem ? [updated.actaItem] : []);
          const existingKeys = new Set(currentItems.map(getActaItemKey));
          const newItems = chosenActaItems.filter((it) => !existingKeys.has(getActaItemKey(it)));
          const combined = [...currentItems, ...newItems];
          updated.actaItems = combined;
          updated.actaItem = combined[0];
        }
      }

      // 5. Pipe Network / Cable Type
      if (applyNetworkOrCable) {
        if (type === 'tuberia') {
          updated.pipeNetworkType = pipeNetworkType;
          updated.pipeColor = getPipeNetworkOption(pipeNetworkType).color;
          if (updated.pipeConduits && updated.pipeConduits.length > 0) {
            updated.pipeConduits = updated.pipeConduits.map((c) => ({
              ...c,
              networkType: pipeNetworkType,
            }));
          }
        } else if (isCableElement) {
          updated.cableType = cableType;
          updated.cableGauge = cableGauge;
        }
      }

      // 6. Verification
      if (applyVerification) {
        updated.verified = verified;
        updated.requiresImmediateAction = requiresImmediateAction;
        if (requiresImmediateAction) {
          updated.status = 'Flagged';
        }
      }

      // 7. Field Notes
      if (applyNotes && fieldNotes.trim()) {
        if (notesMode === 'append') {
          updated.fieldNotes = updated.fieldNotes?.trim()
            ? `${updated.fieldNotes.trim()}\n\n[Ajuste grupal]: ${fieldNotes.trim()}`
            : fieldNotes.trim();
        } else {
          updated.fieldNotes = fieldNotes.trim();
        }
      }

      return updated;
    });

    const summaryMsg = `Ajuste grupal aplicado a ${photos.length} elementos: ${summaryParts.join(', ')}`;
    onSave(updatedPhotos, summaryMsg);
    onClose();
  };

  if (!isOpen || !photos.length) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-950/60 p-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xs sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-edit-modal-title"
        className="flex max-h-[94dvh] min-h-0 w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#9fc2d2] bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 sm:max-h-[90vh] sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#c2c6d4] bg-[#e6f6ff] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#004d99] text-white shadow-xs">
              <span className="material-symbols-outlined text-[20px]">dynamic_feed</span>
            </div>
            <div>
              <h3 id="bulk-edit-modal-title" className="font-['Hanken_Grotesk'] text-base font-bold text-[#071e27] sm:text-lg">
                Edición Grupal de Propiedades
              </h3>
              <p className="text-xs text-[#527284]">
                {counts.total} elemento{counts.total === 1 ? '' : 's'} seleccionado{counts.total === 1 ? '' : 's'} · Actualiza acta, avance y estado simultáneamente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#424752] transition hover:bg-white/80 hover:text-[#ba1a1a]"
            title="Cerrar ventana"
            aria-label="Cerrar ventana"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Selected Elements Chips Summary */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#d8e6ee] bg-[#f7fbfd] px-4 py-2 text-xs text-[#0b4770] sm:px-6">
          <span className="font-bold">Afectará a:</span>
          {counts.cameras > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 font-semibold text-sky-900">
              <span className="material-symbols-outlined text-[13px]">videocam</span>
              {counts.cameras} cámara{counts.cameras > 1 ? 's' : ''}
            </span>
          )}
          {counts.pipes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-900">
              <span className="material-symbols-outlined text-[13px]">timeline</span>
              {counts.pipes} tubería{counts.pipes > 1 ? 's' : ''}
            </span>
          )}
          {counts.cables > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 font-semibold text-purple-900">
              <span className="material-symbols-outlined text-[13px]">cable</span>
              {counts.cables} cableado{counts.cables > 1 ? 's' : ''}
            </span>
          )}
          {counts.electrical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
              <span className="material-symbols-outlined text-[13px]">bolt</span>
              {counts.electrical} eléctrico{counts.electrical > 1 ? 's' : ''}
            </span>
          )}
          {counts.boxes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">
              <span className="material-symbols-outlined text-[13px]">inventory_2</span>
              {counts.boxes} caja{counts.boxes > 1 ? 's' : ''}
            </span>
          )}
          <span className="ml-auto text-[11px] text-[#527284]">
            Marca las casillas que deseas modificar
          </span>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6"
        >
          {/* ================= 1. ESTADO Y AVANCE ================= */}
          <div
            className={`rounded-xl border transition-all ${
              applyProgress
                ? 'border-[#004d99] bg-[#f0f8ff]/70 shadow-xs'
                : 'border-[#d0dee6] bg-[#fafcfd] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#d8e6ee] px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2.5 font-bold text-sm text-[#071e27]">
                <input
                  type="checkbox"
                  checked={applyProgress}
                  onChange={(e) => setApplyProgress(e.target.checked)}
                  className="h-4 w-4 rounded border-[#7da1b5] text-[#004d99] focus:ring-[#004d99]"
                />
                <span className="material-symbols-outlined text-[18px] text-[#004d99]">donut_large</span>
                Estado de Ejecución y Avance (%)
              </label>
              <span
                className={`text-[11px] font-bold ${
                  applyProgress ? 'text-[#004d99]' : 'text-[#7d99a8]'
                }`}
              >
                {applyProgress ? 'Se aplicará' : 'Sin cambios'}
              </span>
            </div>

            {applyProgress && (
              <div className="space-y-3.5 p-4 animate-in fade-in duration-150">
                {/* Status Selection Buttons */}
                <div>
                  <label className="block text-xs font-bold text-[#355365] mb-1.5">
                    Estado de Ejecución
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusChange('No iniciado')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                        executionStatus === 'No iniciado'
                          ? 'border-red-500 bg-red-500 text-white shadow-xs'
                          : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-red-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      No iniciado (0%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('En proceso')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                        executionStatus === 'En proceso'
                          ? 'border-[#004d99] bg-[#004d99] text-white shadow-xs'
                          : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#e6f6ff]'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      En proceso
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('Terminado')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                        executionStatus === 'Terminado'
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-emerald-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      Terminado (100%)
                    </button>
                  </div>
                </div>

                {/* Progress Slider & Input */}
                <div className="rounded-lg border border-[#c2dce9] bg-white p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#071e27]">Porcentaje de Avance</span>
                    <span className="font-mono text-sm font-bold text-[#004d99]">{progressPercentage}%</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progressPercentage}
                    onChange={(e) => handleProgressChange(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e1edf4] accent-[#004d99]"
                  />

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[#527284]">Valores rápidos:</span>
                    {[0, 25, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleProgressChange(preset)}
                        className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold transition ${
                          progressPercentage === preset
                            ? 'bg-[#004d99] text-white'
                            : 'border border-[#c2dce9] bg-[#f4f9fc] text-[#0b4770] hover:bg-[#e4f2fa]'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================= 2. ACTA DE OBRA ================= */}
          <div
            className={`rounded-xl border transition-all ${
              applyActa
                ? 'border-[#004d99] bg-[#f0f8ff]/70 shadow-xs'
                : 'border-[#d0dee6] bg-[#fafcfd] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#d8e6ee] px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2.5 font-bold text-sm text-[#071e27]">
                <input
                  type="checkbox"
                  checked={applyActa}
                  onChange={(e) => setApplyActa(e.target.checked)}
                  className="h-4 w-4 rounded border-[#7da1b5] text-[#004d99] focus:ring-[#004d99]"
                />
                <span className="material-symbols-outlined text-[18px] text-[#004d99]">description</span>
                Asignación de Acta de Obra
              </label>
              <span
                className={`text-[11px] font-bold ${
                  applyActa ? 'text-[#004d99]' : 'text-[#7d99a8]'
                }`}
              >
                {applyActa ? 'Se aplicará' : 'Sin cambios'}
              </span>
            </div>

            {applyActa && (
              <div className="space-y-3 p-4 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsClearingActa(false)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-bold transition ${
                      !isClearingActa
                        ? 'border-[#004d99] bg-[#004d99] text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#e6f6ff]'
                    }`}
                  >
                    Asignar Acta
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsClearingActa(true)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-bold transition ${
                      isClearingActa
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-amber-50'
                    }`}
                  >
                    Dejar Sin Acta (Quitar)
                  </button>
                </div>

                {!isClearingActa && (
                  <div className="space-y-2.5 rounded-lg border border-[#c2dce9] bg-white p-3">
                    <div>
                      <label className="block text-xs font-bold text-[#355365] mb-1">
                        Seleccionar Acta Existente
                      </label>
                      <select
                        value={selectedActa}
                        onChange={(e) => setSelectedActa(e.target.value)}
                        className="w-full rounded-lg border border-[#c2c6d4] bg-[#f8fbfe] p-2 text-sm font-semibold text-[#071e27] focus:border-[#004d99] focus:outline-none"
                      >
                        {actas.map((acta) => (
                          <option key={acta} value={acta}>
                            {acta}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Add new acta inline */}
                    <div className="pt-1 border-t border-[#e2eef5]">
                      <label className="block text-[11px] font-bold text-[#527284] mb-1">
                        O agregar nueva acta al catálogo:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newActaInput}
                          onChange={(e) => setNewActaInput(e.target.value)}
                          placeholder="Ej. Acta 11, Acta Final..."
                          className="flex-1 rounded-lg border border-[#c2c6d4] bg-[#f8fbfe] px-3 py-1.5 text-xs text-[#071e27] focus:border-[#004d99] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddNewActa}
                          className="rounded-lg bg-[#004d99] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#003870]"
                        >
                          Crear y Usar
                        </button>
                      </div>
                      {actaNotice && (
                        <p className="mt-1 text-[11px] text-emerald-700 font-medium">{actaNotice}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ================= 3. RÓTULO DE ACTA EN EL PLANO ================= */}
          <div
            className={`rounded-xl border transition-all ${
              applyActaLabelDisplay
                ? 'border-[#004d99] bg-[#f0f8ff]/70 shadow-xs'
                : 'border-[#d0dee6] bg-[#fafcfd] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#d8e6ee] px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2.5 font-bold text-sm text-[#071e27]">
                <input
                  type="checkbox"
                  checked={applyActaLabelDisplay}
                  onChange={(e) => setApplyActaLabelDisplay(e.target.checked)}
                  className="h-4 w-4 rounded border-[#7da1b5] text-[#004d99] focus:ring-[#004d99]"
                />
                <span className="material-symbols-outlined text-[18px] text-[#004d99]">label</span>
                Visibilidad y Posición del Rótulo de Acta en Plano
              </label>
              <span
                className={`text-[11px] font-bold ${
                  applyActaLabelDisplay ? 'text-[#004d99]' : 'text-[#7d99a8]'
                }`}
              >
                {applyActaLabelDisplay ? 'Se aplicará' : 'Sin cambios'}
              </span>
            </div>

            {applyActaLabelDisplay && (
              <div className="space-y-3 p-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowActaLabel(true)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                      showActaLabel
                        ? 'border-[#004d99] bg-[#004d99] text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#e6f6ff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    Mostrar Rótulo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowActaLabel(false)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                      !showActaLabel
                        ? 'border-[#527284] bg-[#527284] text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                    Ocultar Rótulo
                  </button>
                </div>

                {showActaLabel && (
                  <div>
                    <label className="block text-xs font-bold text-[#355365] mb-1.5">
                      Posición del Rótulo respecto al Icono
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['arriba', 'abajo', 'izquierda', 'derecha'] as ActaLabelPosition[]).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setActaLabelPosition(pos)}
                          className={`rounded-lg border py-1.5 text-xs font-bold capitalize transition ${
                            actaLabelPosition === pos
                              ? 'border-[#004d99] bg-[#e6f6ff] text-[#004d99]'
                              : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#f3faff]'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ================= 4. ÍTEMS DE ACTA DE OBRA ================= */}
          <div
            className={`rounded-xl border transition-all ${
              applyActaItems
                ? 'border-[#004d99] bg-[#f0f8ff]/70 shadow-xs'
                : 'border-[#d0dee6] bg-[#fafcfd] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#d8e6ee] px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2.5 font-bold text-sm text-[#071e27]">
                <input
                  type="checkbox"
                  checked={applyActaItems}
                  onChange={(e) => setApplyActaItems(e.target.checked)}
                  className="h-4 w-4 rounded border-[#7da1b5] text-[#004d99] focus:ring-[#004d99]"
                />
                <span className="material-symbols-outlined text-[18px] text-[#004d99]">checklist</span>
                Ítems de Acta del Catálogo ({selectedActaItemKeys.length} seleccionados)
              </label>
              <span
                className={`text-[11px] font-bold ${
                  applyActaItems ? 'text-[#004d99]' : 'text-[#7d99a8]'
                }`}
              >
                {applyActaItems ? 'Se aplicará' : 'Sin cambios'}
              </span>
            </div>

            {applyActaItems && (
              <div className="space-y-3 p-4 animate-in fade-in duration-150">
                {/* Mode Selector */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActaItemsMode('replace')}
                    className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                      actaItemsMode === 'replace'
                        ? 'border-[#004d99] bg-[#004d99] text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#e6f6ff]'
                    }`}
                  >
                    Reemplazar ítems
                  </button>
                  <button
                    type="button"
                    onClick={() => setActaItemsMode('append')}
                    className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                      actaItemsMode === 'append'
                        ? 'border-[#004d99] bg-[#004d99] text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#e6f6ff]'
                    }`}
                  >
                    Agregar a existentes
                  </button>
                  <button
                    type="button"
                    onClick={() => setActaItemsMode('clear')}
                    className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                      actaItemsMode === 'clear'
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-amber-50'
                    }`}
                  >
                    Quitar todos
                  </button>
                </div>

                {actaItemsMode !== 'clear' && (
                  <div className="rounded-lg border border-[#c2dce9] bg-white p-3 space-y-2.5">
                    {/* Search Input */}
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2.5 top-2 text-[18px] text-[#7d99a8]">
                        search
                      </span>
                      <input
                        type="text"
                        value={itemSearchQuery}
                        onChange={(e) => setItemSearchQuery(e.target.value)}
                        placeholder="Buscar ítem por código o descripción..."
                        className="w-full rounded-lg border border-[#c2c6d4] bg-[#f8fbfe] py-1.5 pl-8 pr-3 text-xs text-[#071e27] focus:border-[#004d99] focus:outline-none"
                      />
                    </div>

                    {/* Selected Badges */}
                    {selectedActaItemKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1 border-b border-[#e2eef5] pb-2">
                        {selectedActaItemKeys.map((key) => {
                          const item = ACTA_ITEM_OPTIONS.find((it) => getActaItemKey(it) === key);
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 rounded-md border border-cyan-300 bg-cyan-50 px-2 py-0.5 font-mono text-[11px] font-bold text-[#075a91]"
                            >
                              <span>{item?.code || key}</span>
                              <button
                                type="button"
                                onClick={() => toggleActaItem(key)}
                                className="text-red-500 hover:text-red-700 font-bold ml-0.5"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Items List */}
                    <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100 pr-1">
                      {filteredActaItems.map((item) => {
                        const itemKey = getActaItemKey(item);
                        const isChecked = selectedActaItemKeys.includes(itemKey);
                        return (
                          <label
                            key={itemKey}
                            className={`flex cursor-pointer items-start gap-2 rounded p-1.5 text-xs transition ${
                              isChecked ? 'bg-[#e6f6ff]' : 'hover:bg-[#f8fbfe]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleActaItem(itemKey)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-[#7da1b5] text-[#004d99] focus:ring-[#004d99]"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#004d99]">{item.code}</span>
                                <span className="text-[10px] text-[#7d99a8]">({item.unit})</span>
                                <span className="text-[10px] text-[#527284] truncate">{item.section}</span>
                              </div>
                              <p className="text-[11px] text-[#355365] line-clamp-2">{item.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ================= 5. RED / CABLE (CONDICIONAL) ================= */}
          {(counts.pipes > 0 || counts.cables > 0) && (
            <div
              className={`rounded-xl border transition-all ${
                applyNetworkOrCable
                  ? 'border-[#004d99] bg-[#f0f8ff]/70 shadow-xs'
                  : 'border-[#d0dee6] bg-[#fafcfd] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#d8e6ee] px-4 py-2.5">
                <label className="flex cursor-pointer items-center gap-2.5 font-bold text-sm text-[#071e27]">
                  <input
                    type="checkbox"
                    checked={applyNetworkOrCable}
                    onChange={(e) => setApplyNetworkOrCable(e.target.checked)}
                    className="h-4 w-4 rounded border-[#7da1b5] text-[#004d99] focus:ring-[#004d99]"
                  />
                  <span className="material-symbols-outlined text-[18px] text-[#004d99]">alt_route</span>
                  Red de Tubería / Tipo de Cable
                </label>
                <span
                  className={`text-[11px] font-bold ${
                    applyNetworkOrCable ? 'text-[#004d99]' : 'text-[#7d99a8]'
                  }`}
                >
                  {applyNetworkOrCable ? 'Se aplicará' : 'Sin cambios'}
                </span>
              </div>

              {applyNetworkOrCable && (
                <div className="space-y-3 p-4 animate-in fade-in duration-150">
                  {counts.pipes > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-[#355365] mb-1.5">
                        Tipo de Red para Tuberías ({counts.pipes})
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {PIPE_NETWORK_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPipeNetworkType(opt.value)}
                            className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-bold transition ${
                              pipeNetworkType === opt.value
                                ? 'border-[#004d99] bg-[#004d99] text-white shadow-xs'
                                : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#e6f6ff]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {counts.cables > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#e2eef5]">
                      <div>
                        <label className="block text-xs font-bold text-[#355365] mb-1">
                          Tipo de Cable ({counts.cables})
                        </label>
                        <select
                          value={cableType}
                          onChange={(e) => setCableType(e.target.value as CableType)}
                          className="w-full rounded-lg border border-[#c2c6d4] bg-[#f8fbfe] p-2 text-xs font-semibold text-[#071e27] focus:border-[#004d99] focus:outline-none"
                        >
                          {CABLE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#355365] mb-1">
                          Calibre de Cable
                        </label>
                        <select
                          value={cableGauge}
                          onChange={(e) => setCableGauge(e.target.value as CableGauge)}
                          className="w-full rounded-lg border border-[#c2c6d4] bg-[#f8fbfe] p-2 text-xs font-semibold text-[#071e27] focus:border-[#004d99] focus:outline-none"
                        >
                          {CABLE_GAUGE_OPTIONS.map((gauge) => (
                            <option key={gauge} value={gauge}>
                              Calibre {gauge} AWG / kcmil
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= 6. VERIFICACIÓN TÉCNICA ================= */}
          <div
            className={`rounded-xl border transition-all ${
              applyVerification
                ? 'border-[#004d99] bg-[#f0f8ff]/70 shadow-xs'
                : 'border-[#d0dee6] bg-[#fafcfd] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#d8e6ee] px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2.5 font-bold text-sm text-[#071e27]">
                <input
                  type="checkbox"
                  checked={applyVerification}
                  onChange={(e) => setApplyVerification(e.target.checked)}
                  className="h-4 w-4 rounded border-[#7da1b5] text-[#004d99] focus:ring-[#004d99]"
                />
                <span className="material-symbols-outlined text-[18px] text-[#004d99]">verified</span>
                Verificación Técnica y Alertas
              </label>
              <span
                className={`text-[11px] font-bold ${
                  applyVerification ? 'text-[#004d99]' : 'text-[#7d99a8]'
                }`}
              >
                {applyVerification ? 'Se aplicará' : 'Sin cambios'}
              </span>
            </div>

            {applyVerification && (
              <div className="space-y-3 p-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerified(true)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                      verified
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-emerald-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Marcar como Verificado
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerified(false)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                      !verified
                        ? 'border-[#527284] bg-[#527284] text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    Desmarcar Verificado
                  </button>
                </div>

                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-[#071e27]">
                  <input
                    type="checkbox"
                    checked={requiresImmediateAction}
                    onChange={(e) => setRequiresImmediateAction(e.target.checked)}
                    className="h-4 w-4 rounded border-[#7da1b5] text-amber-600 focus:ring-amber-600"
                  />
                  <span className="font-semibold text-amber-900">
                    Marcar como "Requiere Acción Inmediata" (Alerta)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* ================= 7. NOTAS DE CAMPO ================= */}
          <div
            className={`rounded-xl border transition-all ${
              applyNotes
                ? 'border-[#004d99] bg-[#f0f8ff]/70 shadow-xs'
                : 'border-[#d0dee6] bg-[#fafcfd] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#d8e6ee] px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2.5 font-bold text-sm text-[#071e27]">
                <input
                  type="checkbox"
                  checked={applyNotes}
                  onChange={(e) => setApplyNotes(e.target.checked)}
                  className="h-4 w-4 rounded border-[#7da1b5] text-[#004d99] focus:ring-[#004d99]"
                />
                <span className="material-symbols-outlined text-[18px] text-[#004d99]">edit_note</span>
                Notas de Campo / Observación
              </label>
              <span
                className={`text-[11px] font-bold ${
                  applyNotes ? 'text-[#004d99]' : 'text-[#7d99a8]'
                }`}
              >
                {applyNotes ? 'Se aplicará' : 'Sin cambios'}
              </span>
            </div>

            {applyNotes && (
              <div className="space-y-2.5 p-4 animate-in fade-in duration-150">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNotesMode('append')}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition ${
                      notesMode === 'append'
                        ? 'border-[#004d99] bg-[#004d99] text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#e6f6ff]'
                    }`}
                  >
                    Anexar al texto existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesMode('replace')}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition ${
                      notesMode === 'replace'
                        ? 'border-[#004d99] bg-[#004d99] text-white'
                        : 'border-[#c2c6d4] bg-white text-[#424752] hover:bg-[#e6f6ff]'
                    }`}
                  >
                    Reemplazar notas
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={fieldNotes}
                  onChange={(e) => setFieldNotes(e.target.value)}
                  placeholder="Escribe la observación grupal..."
                  className="w-full rounded-lg border border-[#c2c6d4] bg-[#f8fbfe] p-2.5 text-xs text-[#071e27] focus:border-[#004d99] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#c2c6d4] bg-slate-50 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#c2c6d4] bg-white px-4 py-2 text-xs font-bold text-[#424752] transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!hasAnyChangeSelected}
              className="inline-flex items-center gap-2 rounded-lg bg-[#004d99] px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#003870] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              Aplicar Cambios a {photos.length} Elemento{photos.length === 1 ? '' : 's'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
