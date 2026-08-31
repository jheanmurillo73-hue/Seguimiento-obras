import type { InspectionPhoto } from '../types';

interface ApplyPhotoUpdatePermissionsParams {
  current: InspectionPhoto;
  updated: InspectionPhoto;
  isAdmin: boolean;
  canAssignActa: boolean;
}

/** Conserva los campos reservados cuando una actualización procede de un inspector. */
export function applyPhotoUpdatePermissions({
  current,
  updated,
  isAdmin,
  canAssignActa,
}: ApplyPhotoUpdatePermissionsParams): InspectionPhoto {
  if (isAdmin) return updated;

  return {
    ...updated,
    name: current.name,
    acta: canAssignActa ? updated.acta : current.acta,
    actaItem: current.actaItem,
    actaItems: current.actaItems,
    actaLabelPosition: current.actaLabelPosition,
    cameraType: current.cameraType,
    elementType: current.elementType,
    planX: current.planX,
    planY: current.planY,
    planEndX: current.planEndX,
    planEndY: current.planEndY,
  };
}
