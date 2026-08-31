import type { CameraCode, CameraType } from '../types';

export function getCameraTypeForCode(cameraCode: CameraCode, currentType: CameraType): CameraType {
  return cameraCode === 'SB858' ? 'Datos' : currentType;
}
