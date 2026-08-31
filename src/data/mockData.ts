import { InspectionPhoto, InspectorProfile, AppSettings, ActivityItem, InspectionCollection, CameraCode, CameraType } from '../types';

export const DEFAULT_INSPECTOR: InspectorProfile = {
  name: 'Ing. Carlos Mendoza',
  role: 'Inspector Senior de Redes MT/BT',
  terminal: 'Terminal A-12 (Zona Norte)',
  id: 'INSP-8842',
  email: 'carlos.mendoza@redeselectricas.com',
  phone: '+57 315 482 9901',
  department: 'Supervisión de Obra y Calidad',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiDBbLLvg2B5k0M06HZaqqowCMmsx43C7fxTCQaVlaJESX35l_Zm_vvaVMHFW4cKQB4PBFEPQjmy9pmvbTElsz9c6-g_dokmoFe-j8qcIehL-VdSKN5BdaJw4j_dhYqqMe5cIkr9ygYoZ7kwM9AV-b2nTUJCgy9R0iLKi17lAdIPFmbjb0XdEa6BNI6wz_m8jGCGdKWJ71ATrWcI6mskw58SqOO4HhrjAsRB0AXdmBhkZhGPeYt0uL',
  documentId: 'CC 1.094.882.140',
  birthDate: '1988-05-14',
  gender: 'Masculino',
  city: 'Bogotá D.C. / Área Metropolitana',
  address: 'Calle 127 # 45-20, Torre 2',
  bloodType: 'O+',
  company: 'Consorcio Eléctrico de Occidente S.A.S.',
  licenseNumber: 'MP-ELEC-2015-8842 (RETIE / CONTE)',
  emergencyContactName: 'Laura Mendoza (Esposa)',
  emergencyContactPhone: '+57 318 902 3341',
  notes: 'Alérgico a la Penicilina. Vacunación Tétanos y Fiebre Amarilla al día.',
};

export const INITIAL_PHOTOS: InspectionPhoto[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  emailNotifications: true,
  pushNotifications: false,
  syncWifiOnly: true,
  highQualityUploads: false,
  allowInspectorActaAssignment: true,
  autoVerifyPassed: true,
  offlineStorageLimitMb: 500,
};

export const INITIAL_COLLECTIONS: InspectionCollection[] = [];

export const INITIAL_ACTIVITIES: ActivityItem[] = [];

export const WAREHOUSE_LOCATIONS: string[] = Array.from(
  { length: 62 },
  (_, i) => `Bodega ${i + 1}`
);

export const CAMERA_CODES: CameraCode[] = ['SB850', 'SB851', 'SB858'];

export const CAMERA_TYPES: CameraType[] = ['MT', 'BT', 'Datos'];

export const PIPE_DIMENSIONS: string[] = ['4"', '6"', '2"', '3"', '8"'];

export const PIPE_QUANTITIES: number[] = [1, 2, 3, 4, 5, 6, 8];

export const TRAMO_PRESETS: string[] = [
  '3x4"',
  '2x6"',
  '2x4"',
  '4x4"',
  '1x6"',
  '3x6"',
  '4x6"',
  '1x4"',
];

export const METRAJE_PRESETS: number[] = [3, 6, 10, 15, 20, 30, 50, 100];

