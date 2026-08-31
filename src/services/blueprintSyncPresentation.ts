import { BlueprintRevision } from './supabaseStorageService';

export interface BlueprintSyncPresentation {
  isLoading: boolean;
  updateNotice: string | null;
  lastModifiedLabel: string | null;
  authorLabel: string | null;
}

const formatRevisionDate = (value: string | null | undefined): string => {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};

export const getBlueprintSyncPresentation = ({
  isLoading,
  isAdmin,
  previousVersion,
  revision,
}: {
  isLoading: boolean;
  isAdmin: boolean;
  previousVersion: string | null;
  revision: BlueprintRevision | null;
}): BlueprintSyncPresentation => {
  const isNewRevision = Boolean(revision?.version && previousVersion !== revision.version);
  const updateNotice = !isAdmin && revision && isNewRevision
    ? previousVersion
      ? `Plano actualizado por ${revision.updatedByName || 'el administrador'}. Se descargó la versión más reciente.`
      : 'Se descargó la versión vigente del plano compartido.'
    : null;

  return {
    isLoading,
    updateNotice,
    lastModifiedLabel: revision ? formatRevisionDate(revision.updatedAt) : null,
    authorLabel: revision?.updatedByName || (revision ? 'Autor no disponible' : null),
  };
};
