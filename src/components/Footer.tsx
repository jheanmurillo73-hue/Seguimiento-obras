import React, { useState } from 'react';

export const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  return (
    <>
      <footer className="w-full py-6 px-6 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#cfe6f2] border-t border-[#c2c6d4] text-[14px]">
        <span className="font-['Inter'] font-bold text-[#071e27] text-center md:text-left">
          © 2024 PhotoVault Pro. Sistemas de Inspección Industrial.
        </span>
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveModal('privacy')}
            className="font-['Inter'] text-[#424752] hover:text-[#004d99] underline transition-colors"
          >
            Política de Privacidad
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('terms')}
            className="font-['Inter'] text-[#424752] hover:text-[#004d99] underline transition-colors"
          >
            Términos del Servicio
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('support')}
            className="font-['Inter'] text-[#424752] hover:text-[#004d99] underline transition-colors"
          >
            Soporte Técnico
          </button>
        </div>
      </footer>

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-[#c2c6d4] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#e6f6ff] p-4 border-b border-[#c2c6d4] flex items-center justify-between">
              <h3 className="font-['Hanken_Grotesk'] font-bold text-[#071e27] text-lg">
                {activeModal === 'privacy' ? 'Política de Privacidad' : activeModal === 'terms' ? 'Términos del Servicio' : 'Soporte Técnico'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-[#424752] hover:text-[#ba1a1a]"
                title="Cerrar modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 text-[14px] text-[#424752] space-y-3 max-h-96 overflow-y-auto">
              {activeModal === 'privacy' && (
                <>
                  <p>Todas las fotografías de inspección estructural y telemetría geográfica recopiladas por PhotoVault Pro se cifran en reposo con estándares AES-256.</p>
                  <p>Los datos de inspección están estrictamente particionados por ID de Terminal e identificación de credencial del Inspector.</p>
                </>
              )}
              {activeModal === 'terms' && (
                <>
                  <p>PhotoVault Pro es un sistema empresarial de inspección industrial autorizado. Queda estrictamente prohibida la extracción o divulgación no autorizada de imágenes de infraestructura crítica.</p>
                  <p>Los inspectores de campo son responsables de verificar la precisión técnica antes de certificar elementos estructurales.</p>
                </>
              )}
              {activeModal === 'support' && (
                <>
                  <p>Para anomalías urgentes de sincronización de terminal o telemetría de campo, contacta a operaciones industriales:</p>
                  <div className="p-3 bg-[#f3faff] border border-[#c2c6d4] rounded-lg text-[13px] space-y-1">
                    <div><strong>Línea de Campo:</strong> +1 (800) 555-VAULT</div>
                    <div><strong>Despacho de Terminal:</strong> terminal-ops@photovault.corp</div>
                    <div><strong>Estado de Nodos:</strong> Todos los nodos operativos (100%)</div>
                  </div>
                </>
              )}
            </div>
            <div className="p-3 bg-[#f3faff] border-t border-[#c2c6d4] flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
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
