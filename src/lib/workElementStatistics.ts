import { ExecutionStatus, InspectionPhoto, getElementType } from '../types';

export const EXECUTION_STATUSES: ReadonlyArray<ExecutionStatus> = ['No iniciado', 'En proceso', 'Terminado'];

export interface StatusBreakdown {
  'No iniciado': number;
  'En proceso': number;
  Terminado: number;
  total: number;
}

export type WorkNetwork = 'MT' | 'BT' | 'Datos';

export interface WorkElementStatistics {
  cameras: Record<WorkNetwork, StatusBreakdown>;
  pipes: Record<WorkNetwork, StatusBreakdown>;
  tubeTotals: Record<WorkNetwork, number>;
  totalCameras: number;
  totalPipes: number;
}

const emptyBreakdown = (): StatusBreakdown => ({
  'No iniciado': 0,
  'En proceso': 0,
  Terminado: 0,
  total: 0,
});

const normalizeCameraType = (value?: string): 'MT' | 'BT' | 'Datos' | null => {
  const normalized = value?.trim().toUpperCase();
  if (normalized === 'MT') return 'MT';
  if (normalized === 'BT') return 'BT';
  if (normalized === 'DATOS' || normalized === 'D') return 'Datos';
  return null;
};

const getPipeNetwork = (network: string): WorkNetwork | null => {
  if (network === 'media_tension') return 'MT';
  if (network === 'baja_tension') return 'BT';
  if (network === 'datos') return 'Datos';
  return null;
};

const getPipeConduits = (photo: InspectionPhoto) => photo.pipeConduits?.length
  ? photo.pipeConduits
  : photo.pipeNetworkType
    ? [{ networkType: photo.pipeNetworkType, configuration: photo.tramo || '' }]
    : [];

const getTubeQuantity = (configuration?: string): number => {
  const match = configuration?.trim().match(/^(\d+)/);
  const quantity = match ? Number(match[1]) : 1;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

const addToBreakdown = (breakdown: StatusBreakdown, status: ExecutionStatus) => {
  breakdown[status] += 1;
  breakdown.total += 1;
};

export const getWorkElementStatistics = (photos: InspectionPhoto[]): WorkElementStatistics => {
  const cameras: WorkElementStatistics['cameras'] = {
    MT: emptyBreakdown(),
    BT: emptyBreakdown(),
    Datos: emptyBreakdown(),
  };
  const pipes: WorkElementStatistics['pipes'] = {
    MT: emptyBreakdown(),
    BT: emptyBreakdown(),
    Datos: emptyBreakdown(),
  };
  const tubeTotals: WorkElementStatistics['tubeTotals'] = { MT: 0, BT: 0, Datos: 0 };
  let totalCameras = 0;
  let totalPipes = 0;

  photos.forEach((photo) => {
    const elementType = getElementType(photo);
    if (elementType === 'camara') {
      totalCameras += 1;
      const cameraType = normalizeCameraType(photo.cameraType);
      if (cameraType) addToBreakdown(cameras[cameraType], photo.executionStatus);
      return;
    }

    if (elementType === 'tuberia') {
      totalPipes += 1;
      getPipeConduits(photo).forEach((conduit) => {
        const pipeType = getPipeNetwork(conduit.networkType);
        if (!pipeType) return;
        addToBreakdown(pipes[pipeType], photo.executionStatus);
        tubeTotals[pipeType] += getTubeQuantity(conduit.configuration);
      });
    }
  });

  return { cameras, pipes, tubeTotals, totalCameras, totalPipes };
};
