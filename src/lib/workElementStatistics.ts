import { ExecutionStatus, InspectionPhoto, getElementType, getPhotoProgressPercentage } from '../types';

export const EXECUTION_STATUSES: ReadonlyArray<ExecutionStatus> = ['No iniciado', 'En proceso', 'Terminado'];

export interface StatusBreakdown {
  'No iniciado': number;
  'En proceso': number;
  Terminado: number;
  total: number;
}

export type WorkNetwork = 'MT' | 'BT' | 'Datos';

export interface PipeProgressIndicators {
  totalMeters: number; // Metros totales de tubería
  inProgressMeters: number; // Metros de tubería en proceso
  completedMeters: number; // Metros de tubería terminada
  notStartedMeters: number; // Metros de tubería no iniciada
  progressPercentage: number; // (Metros terminados / Metros totales) * 100
  weightedProgressPercentage: number; // Ponderado por % de avance de cada tramo
}

export interface CameraProgressIndicators {
  totalCount: number; // Cantidad total de cámaras
  inProgressCount: number; // Cantidad de cámaras en proceso
  completedCount: number; // Cantidad de cámaras terminadas
  notStartedCount: number; // Cantidad de cámaras no iniciadas
  inProgressAvgProgressPercentage: number; // Porcentaje de avance promedio de cámaras en proceso (0 a 100)
  progressPercentage: number; // ((Cámaras terminadas + (Cámaras en proceso * % avance promedio / 100)) / Cámaras totales) * 100
}

export interface WorkElementStatistics {
  cameras: Record<WorkNetwork, StatusBreakdown>;
  pipes: Record<WorkNetwork, StatusBreakdown>;
  tubeTotals: Record<WorkNetwork, number>;
  totalCameras: number;
  totalPipes: number;
  pipeIndicators: PipeProgressIndicators;
  cameraIndicators: CameraProgressIndicators;
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
    ? [{ networkType: photo.pipeNetworkType, configuration: photo.tramo || '', meters: photo.metraje || 0 }]
    : [];

export const getPhotoPipeMeters = (photo: InspectionPhoto): number => {
  const conduits = photo.pipeConduits;
  if (conduits && conduits.length > 0) {
    const sum = conduits.reduce((total, conduit) => {
      const parsed = Number(conduit.meters);
      return total + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    }, 0);
    if (sum > 0) return sum;
  }
  const directMeters = Number(photo.metraje);
  return Number.isFinite(directMeters) && directMeters > 0 ? directMeters : 0;
};

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

  // Camera indicators accumulators
  let cameraCompleted = 0;
  let cameraInProgress = 0;
  let cameraNotStarted = 0;
  const inProgressCameraPercentages: number[] = [];

  // Pipe indicators accumulators
  let totalPipeMeters = 0;
  let inProgressPipeMeters = 0;
  let completedPipeMeters = 0;
  let notStartedPipeMeters = 0;
  let weightedPipeSum = 0;

  photos.forEach((photo) => {
    const elementType = getElementType(photo);
    const progress = getPhotoProgressPercentage(photo);

    if (elementType === 'camara') {
      totalCameras += 1;
      const cameraType = normalizeCameraType(photo.cameraType);
      if (cameraType) addToBreakdown(cameras[cameraType], photo.executionStatus);

      if (photo.executionStatus === 'Terminado' || progress === 100) {
        cameraCompleted += 1;
      } else if (photo.executionStatus === 'No iniciado' || progress === 0) {
        cameraNotStarted += 1;
      } else {
        cameraInProgress += 1;
        inProgressCameraPercentages.push(progress);
      }
      return;
    }

    if (elementType === 'tuberia') {
      totalPipes += 1;
      const meters = getPhotoPipeMeters(photo);
      totalPipeMeters += meters;
      weightedPipeSum += meters * (progress / 100);

      if (photo.executionStatus === 'Terminado' || progress === 100) {
        completedPipeMeters += meters;
      } else if (photo.executionStatus === 'No iniciado' || progress === 0) {
        notStartedPipeMeters += meters;
      } else {
        inProgressPipeMeters += meters;
      }

      getPipeConduits(photo).forEach((conduit) => {
        const pipeType = getPipeNetwork(conduit.networkType);
        if (!pipeType) return;
        addToBreakdown(pipes[pipeType], photo.executionStatus);
        tubeTotals[pipeType] += getTubeQuantity(conduit.configuration);
      });
    }
  });

  // Calculate Camera Indicators (Formula 5.2)
  const inProgressAvgProgressPercentage = inProgressCameraPercentages.length > 0
    ? inProgressCameraPercentages.reduce((acc, val) => acc + val, 0) / inProgressCameraPercentages.length
    : 0;

  const cameraProgressPercentage = totalCameras > 0
    ? ((cameraCompleted + (cameraInProgress * (inProgressAvgProgressPercentage / 100))) / totalCameras) * 100
    : 0;

  const cameraIndicators: CameraProgressIndicators = {
    totalCount: totalCameras,
    inProgressCount: cameraInProgress,
    completedCount: cameraCompleted,
    notStartedCount: cameraNotStarted,
    inProgressAvgProgressPercentage: Number(inProgressAvgProgressPercentage.toFixed(2)),
    progressPercentage: Number(cameraProgressPercentage.toFixed(2)),
  };

  // Calculate Pipe Indicators (Formula 5.1)
  const pipeProgressPercentage = totalPipeMeters > 0
    ? (completedPipeMeters / totalPipeMeters) * 100
    : 0;

  const weightedProgressPercentage = totalPipeMeters > 0
    ? (weightedPipeSum / totalPipeMeters) * 100
    : 0;

  const pipeIndicators: PipeProgressIndicators = {
    totalMeters: Number(totalPipeMeters.toFixed(2)),
    inProgressMeters: Number(inProgressPipeMeters.toFixed(2)),
    completedMeters: Number(completedPipeMeters.toFixed(2)),
    notStartedMeters: Number(notStartedPipeMeters.toFixed(2)),
    progressPercentage: Number(pipeProgressPercentage.toFixed(2)),
    weightedProgressPercentage: Number(weightedProgressPercentage.toFixed(2)),
  };

  return {
    cameras,
    pipes,
    tubeTotals,
    totalCameras,
    totalPipes,
    pipeIndicators,
    cameraIndicators,
  };
};
