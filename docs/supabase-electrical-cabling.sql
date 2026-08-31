-- Habilita el cableado longitudinal para Obras Eléctricas MT, BT y Alumbrado.
-- No agrega este recurso a la capa de Obras Civiles.

ALTER TABLE public.inspection_photos
ADD COLUMN IF NOT EXISTS cable_type TEXT
CHECK (cable_type IS NULL OR cable_type IN ('media_tension', 'baja_tension', 'alumbrado'));

ALTER TABLE public.inspection_photos
ADD COLUMN IF NOT EXISTS cable_gauge TEXT
CHECK (cable_gauge IS NULL OR cable_gauge IN ('350', '500', '2/0', '4/0', '12', '10', '8', '6'));

ALTER TABLE public.inspection_photos
ADD COLUMN IF NOT EXISTS cable_meters TEXT;
