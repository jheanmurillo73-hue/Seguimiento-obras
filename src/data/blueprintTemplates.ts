// Pre-configured industrial blueprint overlays for industrial plant & pipeline layout
export const DEFAULT_BLUEPRINT_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="%230b192c" fill-opacity="0.9" />
  <!-- Grid background -->
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="%231e3e62" stroke-width="0.75" stroke-dasharray="2,2"/>
    </pattern>
    <pattern id="mainGrid" width="160" height="160" patternUnits="userSpaceOnUse">
      <rect width="160" height="160" fill="url(%23grid)" />
      <path d="M 160 0 L 0 0 0 160" fill="none" stroke="%2300ffff" stroke-width="1" stroke-opacity="0.3"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="url(%23mainGrid)" />

  <!-- Outer perimeter boundary -->
  <rect x="50" y="50" width="700" height="500" fill="none" stroke="%2300ffff" stroke-width="3" stroke-dasharray="8,4" />
  <text x="60" y="40" fill="%2300ffff" font-family="monospace" font-size="14" font-weight="bold">PLANO GENERAL DE PLANTA INDUSTRIAL - RED DE DUCTOS Y CÁMARAS MT/BT</text>
  
  <!-- Substation building -->
  <rect x="90" y="90" width="220" height="160" fill="%23004d99" fill-opacity="0.4" stroke="%2300ffff" stroke-width="2"/>
  <text x="110" y="125" fill="%23ffffff" font-family="sans-serif" font-size="14" font-weight="bold">SUBESTACIÓN PRINCIPAL</text>
  <text x="110" y="145" fill="%2390caf9" font-family="sans-serif" font-size="11">Transformador MT 13.2kV / BT 440V</text>
  <rect x="110" y="160" width="80" height="70" fill="%2300ffff" fill-opacity="0.2" stroke="%2300ffff" stroke-width="1.5"/>
  <text x="120" y="195" fill="%2300ffff" font-family="monospace" font-size="10">CELDA MT</text>

  <!-- Warehouse bays -->
  <g stroke="%234fc3f7" stroke-width="1.5" fill="%231e3e62" fill-opacity="0.3">
    <rect x="360" y="90" width="180" height="200" />
    <text x="380" y="120" fill="%23ffffff" font-family="sans-serif" font-size="13" font-weight="bold">BODEGA 1 (A-01)</text>
    <text x="380" y="140" fill="%2390caf9" font-family="sans-serif" font-size="10">Zona de Carga Pesada</text>
    
    <rect x="560" y="90" width="160" height="200" />
    <text x="580" y="120" fill="%23ffffff" font-family="sans-serif" font-size="13" font-weight="bold">BODEGA 2 (A-02)</text>
    <text x="580" y="140" fill="%2390caf9" font-family="sans-serif" font-size="10">Almacenamiento Seco</text>

    <rect x="360" y="320" width="360" height="200" />
    <text x="380" y="350" fill="%23ffffff" font-family="sans-serif" font-size="13" font-weight="bold">NAVE DE PRODUCCIÓN INDUSTRIAL (B-01)</text>
  </g>

  <!-- Main Pipeline Conduit Traces -->
  <!-- MT Red Route -->
  <path d="M 200 250 L 200 420 L 360 420 L 520 420 L 640 420" fill="none" stroke="%2300e5ff" stroke-width="4" stroke-linecap="round"/>
  <!-- BT Line Route -->
  <path d="M 310 170 L 360 170 L 360 250 L 560 250" fill="none" stroke="%23ffb300" stroke-width="3" stroke-dasharray="6,3" stroke-linecap="round"/>
  
  <!-- Camera / Manhole Boxes on Blueprint -->
  <!-- Box SB850 -->
  <circle cx="200" cy="250" r="14" fill="%23004d99" stroke="%2300ffff" stroke-width="3" />
  <rect x="192" y="242" width="16" height="16" fill="%23ffffff"/>
  <text x="140" y="240" fill="%2300ffff" font-family="monospace" font-size="12" font-weight="bold">CÁMARA SB850</text>
  <text x="140" y="255" fill="%23b3e5fc" font-family="sans-serif" font-size="10">Caja de Paso MT</text>

  <!-- Box SB851 -->
  <circle cx="360" cy="420" r="14" fill="%23004d99" stroke="%2300ffff" stroke-width="3" />
  <rect x="352" y="412" width="16" height="16" fill="%23ffffff"/>
  <text x="375" y="415" fill="%2300ffff" font-family="monospace" font-size="12" font-weight="bold">CÁMARA SB851</text>
  <text x="375" y="430" fill="%23b3e5fc" font-family="sans-serif" font-size="10">Tramo 3x4" • 15.0m</text>

  <!-- Box SB858 -->
  <circle cx="640" cy="420" r="14" fill="%23004d99" stroke="%2300ffff" stroke-width="3" />
  <rect x="632" y="412" width="16" height="16" fill="%23ffffff"/>
  <text x="610" y="455" fill="%2300ffff" font-family="monospace" font-size="12" font-weight="bold">CÁMARA SB858</text>
  <text x="610" y="470" fill="%23b3e5fc" font-family="sans-serif" font-size="10">Tramo 2x6" • 28.0m</text>

  <!-- Conduit Dimensions and Annotations -->
  <g fill="%23ffeb3b" font-family="monospace" font-size="11" font-weight="bold">
    <rect x="230" y="405" width="90" height="20" fill="%230b192c" rx="4" stroke="%23ffeb3b" stroke-width="1"/>
    <text x="240" y="419">3x4" (15m)</text>

    <rect x="420" y="405" width="90" height="20" fill="%230b192c" rx="4" stroke="%23ffeb3b" stroke-width="1"/>
    <text x="430" y="419">3x4" (12m)</text>

    <rect x="540" y="405" width="90" height="20" fill="%230b192c" rx="4" stroke="%23ffeb3b" stroke-width="1"/>
    <text x="550" y="419">2x6" (28m)</text>
  </g>

  <!-- North Arrow and Scale Bar -->
  <g transform="translate(710, 80)">
    <circle cx="0" cy="0" r="22" fill="%230b192c" stroke="%2300ffff" stroke-width="1.5" />
    <polygon points="0,-18 6,6 0,2 -6,6" fill="%23ff5252" />
    <polygon points="0,18 6,2 0,6 -6,2" fill="%23ffffff" />
    <text x="-4" y="-22" fill="%23ff5252" font-family="sans-serif" font-size="12" font-weight="bold">N</text>
  </g>

  <!-- Legend -->
  <g transform="translate(60, 480)" fill="%23ffffff" font-family="sans-serif" font-size="10">
    <rect x="0" y="0" width="220" height="60" fill="%230b192c" fill-opacity="0.8" rx="6" stroke="%231e3e62" stroke-width="1"/>
    <line x1="15" y1="18" x2="45" y2="18" stroke="%2300e5ff" stroke-width="3"/>
    <text x="55" y="21">Ductería Media Tensión (MT)</text>
    
    <line x1="15" y1="36" x2="45" y2="36" stroke="%23ffb300" stroke-width="2" stroke-dasharray="4,2"/>
    <text x="55" y="39">Ductería Baja Tensión (BT)</text>
    
    <circle cx="30" cy="50" r="5" fill="%23004d99" stroke="%2300ffff" stroke-width="1.5"/>
    <text x="55" y="53">Cajas de Inspección / Cámaras</text>
  </g>
</svg>`;

export const SAMPLE_BLUEPRINTS = [
  {
    id: 'bp-1',
    name: 'Plano General Subestación y Red MT/BT',
    description: 'Trazado técnico de canalizaciones, cámaras SB850-SB858 y bodegas',
    imageUrl: DEFAULT_BLUEPRINT_SVG,
    defaultOpacity: 0.75,
  },
  {
    id: 'bp-2',
    name: 'Esquema Unifilar y Distribución de Cajas',
    description: 'Diagrama de distribución y cotas de metrajes de tubería',
    imageUrl: DEFAULT_BLUEPRINT_SVG,
    defaultOpacity: 0.65,
  },
];
