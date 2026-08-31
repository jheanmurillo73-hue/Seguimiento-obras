import React from 'react';
import { InspectorProfile } from '../types';

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  inspector: InspectorProfile;
}

export const SignOutModal: React.FC<SignOutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  inspector,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full border border-[#c2c6d4] shadow-2xl p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-[#ba1a1a] mb-3">
          <span className="material-symbols-outlined text-3xl">logout</span>
          <h3 className="font-['Hanken_Grotesk'] font-bold text-xl text-[#071e27]">
            Cerrar Sesión del Terminal
          </h3>
        </div>
        <p className="text-[14px] text-[#424752] mb-4">
          ¿Estás seguro de que deseas bloquear y cerrar la sesión de <strong>{inspector.name}</strong> ({inspector.terminal})? Los borradores no guardados quedarán cifrados localmente.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#c2c6d4] text-[#424752] font-bold text-[13px] rounded-lg hover:bg-[#e6f6ff]"
          >
            Permanecer Conectado
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-[#004d99] text-white font-bold text-[13px] rounded-lg hover:bg-[#1565c0]"
          >
            Bloquear y Salir
          </button>
        </div>
      </div>
    </div>
  );
};
