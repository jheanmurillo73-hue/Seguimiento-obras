import React, { useState } from 'react';
import { InspectionCollection, InspectionPhoto } from '../types';

interface CollectionsViewProps {
  collections: InspectionCollection[];
  photos: InspectionPhoto[];
  onSelectPhoto: (photo: InspectionPhoto) => void;
  onNavigateToUpload: () => void;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  photos,
  onSelectPhoto,
  onNavigateToUpload,
}) => {
  const [selectedCollection, setSelectedCollection] = useState<InspectionCollection | null>(null);

  const getCollectionPhotos = (col: InspectionCollection) => {
    return photos.filter((p) => col.photoIds.includes(p.id));
  };

  return (
    <div className="max-w-[1280px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            {selectedCollection && (
              <button
                type="button"
                onClick={() => setSelectedCollection(null)}
                className="text-[#004d99] hover:underline font-bold text-[14px] flex items-center gap-1 mr-2"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Colecciones /
              </button>
            )}
            <h1 className="font-['Hanken_Grotesk'] text-2xl sm:text-[32px] font-bold text-[#071e27] leading-tight">
              {selectedCollection ? selectedCollection.title : 'Colecciones de Inspección'}
            </h1>
          </div>
          <p className="font-['Inter'] text-[14px] text-[#424752] mt-1.5">
            {selectedCollection
              ? selectedCollection.description
              : 'Álbumes de campo categorizados, expedientes de auditoría estructural y grupos de cumplimiento.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToUpload}
          className="bg-[#004d99] hover:bg-[#00468c] text-white font-['Inter'] font-bold text-[14px] px-6 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
          Subir a Colección
        </button>
      </div>

      {!selectedCollection ? (
        /* Collections Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {collections.map((col) => {
            const count = photos.filter((p) => col.photoIds.includes(p.id)).length;
            return (
              <div
                key={col.id}
                onClick={() => setSelectedCollection(col)}
                className="bg-white rounded-xl border border-[#c2c6d4] overflow-hidden hover:border-[#004d99] hover:shadow-md transition-all cursor-pointer flex flex-col group"
              >
                <div className="h-48 relative overflow-hidden bg-[#cfe6f2]">
                  <img
                    src={col.coverImage}
                    alt={col.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-4">
                    <div className="text-white">
                      <span className="text-[11px] font-bold uppercase tracking-wider bg-[#004d99] px-2 py-0.5 rounded">
                        {col.category}
                      </span>
                      <h3 className="font-['Hanken_Grotesk'] font-bold text-lg text-white mt-1">
                        {col.title}
                      </h3>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs text-[#004d99] text-[12px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                    {count} {count === 1 ? 'Foto' : 'Fotos'}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <p className="font-['Inter'] text-[13px] text-[#424752] line-clamp-2">
                    {col.description}
                  </p>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#e6f6ff] text-[12px] text-[#727783]">
                    <span>Última actualización: {col.lastUpdated}</span>
                    <span className="font-bold text-[#004d99] group-hover:translate-x-1 transition-transform inline-flex items-center gap-0.5">
                      Explorar <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Inside Selected Collection */
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {getCollectionPhotos(selectedCollection).map((photo) => {
              const execStatus = photo.executionStatus || 'En proceso';
              return (
                <div
                  key={photo.id}
                  onClick={() => onSelectPhoto(photo)}
                  className="bg-[#f3faff] rounded-xl border border-[#c2c6d4] overflow-hidden group hover:border-[#004d99] transition-all cursor-pointer flex flex-col"
                >
                  <div className="aspect-square relative overflow-hidden bg-[#cfe6f2]">
                    <img
                      src={photo.imageUrl}
                      alt={photo.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[11px] font-mono px-2 py-0.5 rounded">
                      {photo.displayId}
                    </div>
                  </div>
                  <div className="p-4 flex flex-col justify-between flex-1">
                    <div>
                      <h4 className="font-['Inter'] font-bold text-[14px] text-[#071e27] truncate">
                        {photo.name}
                      </h4>
                      <p className="text-[12px] text-[#727783] truncate mt-0.5">
                        {photo.location}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#dbf1fe] text-[12px]">
                      <span className="text-[#424752]">{photo.date.split(',')[0]}</span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            execStatus === 'Terminado'
                              ? 'bg-[#a0f399] text-[#217128]'
                              : 'bg-[#fef3c7] text-[#92400e]'
                          }`}
                        >
                          {execStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
