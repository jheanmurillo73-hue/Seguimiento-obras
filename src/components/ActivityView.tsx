import React from 'react';
import { ActivityItem, InspectionPhoto } from '../types';

interface ActivityViewProps {
  activities: ActivityItem[];
  photos: InspectionPhoto[];
  onOpenPhoto: (photoId: string) => void;
  onClearLogs?: () => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  activities,
  photos,
  onOpenPhoto,
}) => {
  const getActionIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'flag':
        return {
          icon: 'warning',
          bg: 'bg-[#ffdad6]',
          color: 'text-[#ba1a1a]',
        };
      case 'verified':
        return {
          icon: 'verified',
          bg: 'bg-[#a0f399]',
          color: 'text-[#217128]',
        };
      case 'upload':
        return {
          icon: 'add_a_photo',
          bg: 'bg-[#cfe6f2]',
          color: 'text-[#004d99]',
        };
      case 'sync':
        return {
          icon: 'cloud_done',
          bg: 'bg-[#dbf1fe]',
          color: 'text-[#1565c0]',
        };
      default:
        return {
          icon: 'edit_note',
          bg: 'bg-[#e6f6ff]',
          color: 'text-[#071e27]',
        };
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-['Hanken_Grotesk'] text-2xl sm:text-[32px] font-bold text-[#071e27] leading-tight">
            Actividad de Campo y Registros de Auditoría
          </h1>
          <p className="font-['Inter'] text-[14px] text-[#424752] mt-1.5">
            Eventos en tiempo real, alertas de riesgo, sincronización e historial de certificación.
          </p>
        </div>
      </div>

      {/* Activity Timeline Card */}
      <div className="bg-white rounded-xl border border-[#c2c6d4] overflow-hidden shadow-2xs">
        <div className="bg-[#F5F7F8] px-6 py-3 border-b border-[#c2c6d4] flex justify-between items-center">
          <span className="font-['Hanken_Grotesk'] font-bold text-[14px] text-[#071e27]">
            Eventos Registrados ({activities.length})
          </span>
          <span className="text-[12px] bg-[#004d99] text-white px-2.5 py-0.5 rounded font-bold">
            En Vivo
          </span>
        </div>

        <div className="divide-y divide-[#dbf1fe]">
          {activities.map((item) => {
            const iconStyle = getActionIcon(item.type);
            const associatedPhoto = photos.find((p) => p.id === item.photoId);

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-[#f3faff] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconStyle.bg} ${iconStyle.color}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {iconStyle.icon}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-['Inter'] font-bold text-[14px] text-[#071e27]">
                        {item.action}
                      </span>
                      <span className="text-[12px] text-[#727783]">• {item.timestamp}</span>
                    </div>

                    <p className="text-[13px] text-[#424752] mt-0.5">
                      Objetivo de inspección: <strong>{item.photoName}</strong>
                    </p>

                    <div className="text-[12px] text-[#727783] mt-1 flex items-center gap-2">
                      <span>Registrado por {item.user}</span>
                      <span>•</span>
                      <span>Terminal A-12</span>
                    </div>
                  </div>
                </div>

                {associatedPhoto && (
                  <button
                    type="button"
                    onClick={() => onOpenPhoto(item.photoId)}
                    className="flex-shrink-0 flex items-center gap-2 p-1.5 rounded-lg border border-[#c2c6d4] hover:border-[#004d99] hover:bg-white bg-[#f3faff] transition-all"
                    title="Ver Inspección"
                  >
                    <img
                      src={associatedPhoto.imageUrl}
                      alt={associatedPhoto.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <span className="hidden sm:inline font-bold text-[12px] text-[#004d99] pr-1">
                      Ver
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
