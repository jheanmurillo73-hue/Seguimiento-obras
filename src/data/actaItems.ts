/**
 * Catálogo de ítems de acta derivado de itemacta.xlsx.
 * Diseño: cartografía técnica sobria; las opciones se agrupan para mantener compacto el editor.
 */
import type { ActaItem } from '../types';

export const ACTA_ITEM_OPTIONS: ReadonlyArray<ActaItem> = [
  {
    "code": "0",
    "description": "CAMPAMENTO DE OBRA - TIPO CONTENEDOR 2 UNIDADES",
    "unit": "MES",
    "quantity": "8",
    "section": "PRELIMINARES"
  },
  {
    "code": "0.2",
    "description": "2 UNIDAD SANITARÍA MOVIL - 2 ASEOS SEMANALES",
    "unit": "MES",
    "quantity": "8",
    "section": "PRELIMINARES"
  },
  {
    "code": "0.3",
    "description": "SEGURIDAD INDUSTRIAL Y SEÑALIZACION GENERAL DE OBRA (deberá cumplir con todo lo indicado en el PMT. paleteros, señalización luminosa, señalización nocturna, etc. Deberá cubrir todos los costos de personal, mano de obra, suministro de materiales y equipos relacionados con los trabajos especificados.)",
    "unit": "GLB",
    "quantity": "1",
    "section": "PRELIMINARES"
  },
  {
    "code": "1.1",
    "description": "SEI ACOMETIDA 3#1/0 XLPE 100% ALUMINIO EN CINTA +1#2 BD",
    "unit": "ML",
    "quantity": "320",
    "section": "ACOMETIDAS MEDIA TENSION"
  },
  {
    "code": "2.1",
    "description": "SEI ACOMETIDA 3#250 +1#250 + 1#2 THHN PARA TABLERO CONTADORES TRAFO ZC",
    "unit": "ML",
    "quantity": "14",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.2",
    "description": "SEI ACOMETIDA 12#350 +4#350 + 1#3/0 THHN PARA TABLEROS DISTRIBUCION TRAFO MANZANA 1",
    "unit": "ML",
    "quantity": "7",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.3",
    "description": "SEI ACOMETIDA 9#350 +3#350 + 1#2/0 THHN PARA TABLEROS DISTRIBUCION TRAFO MANZANA 2",
    "unit": "ML",
    "quantity": "7",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.4",
    "description": "SEI ACOMETIDA 18#350 +6#350 + 1#4/0 THHN PARA TABLEROS DISTRIBUCION TRAFO MANZANA 3",
    "unit": "ML",
    "quantity": "7",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.5",
    "description": "SEI ACOMETIDA 18#350 +6#350 + 1#4/0 THHN PARA TABLEROS DISTRIBUCION TRAFO MANZANA 4",
    "unit": "ML",
    "quantity": "7",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.6",
    "description": "SEI ACOMETIDA 18#350 +6#350 + 1#4/0 THHN PARA TABLEROS DISTRIBUCION TRAFO MANZANA 5",
    "unit": "ML",
    "quantity": "7",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.7",
    "description": "SEI ACOMETIDA 6#250 +2#250 + 1#2 THHN PARA TABLERO CONTADORES TRAFO MANZANA 1",
    "unit": "ML",
    "quantity": "10",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.8",
    "description": "SEI ACOMETIDA 6#250 +2#250 + 1#2 THHN PARA TABLERO CONTADORES TRAFO MANZANA 3",
    "unit": "ML",
    "quantity": "15",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.9",
    "description": "SEI ACOMETIDA 6#250 +2#250 + 1#2 THHN PARA TABLERO CONTADORES TRAFO MANZANA 4",
    "unit": "ML",
    "quantity": "15",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.10",
    "description": "SEI ACOMETIDA 6#250 +2#250 + 1#2 THHN PARA TABLERO CONTADORES TRAFO MANZANA 5",
    "unit": "ML",
    "quantity": "15",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.11",
    "description": "SEI ACOMETIDA 3#4 +1#4 + 1#8 THHN PARA TABLERO OFICINAS",
    "unit": "ML",
    "quantity": "55",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.12",
    "description": "SEI ACOMETIDA 3#4 +1#4 + 1#8 THHN PARA TABLERO AIRES ACONDICIONADOS OFICINAS",
    "unit": "ML",
    "quantity": "55",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.13",
    "description": "SEI ACOMETIDA 3#8 +1#8 + 1#10 THHN PARA TABLERO ZONAS COMUNES",
    "unit": "ML",
    "quantity": "5",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.14",
    "description": "SEI ACOMETIDA 3#8 +1#8 + 1#10 THHN PARA TABLERO RED CONTRA INCENDIO",
    "unit": "ML",
    "quantity": "30",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.15",
    "description": "SEI ACOMETIDA 3#8 +1#8 + 1#10 THHN PARA TABLERO HIDROSANITARIO",
    "unit": "ML",
    "quantity": "17",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.16",
    "description": "SEI BORNA TERMINAL #350",
    "unit": "UN",
    "quantity": "200",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.17",
    "description": "SEI BORNA TERMINAL #250",
    "unit": "UN",
    "quantity": "176",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.18",
    "description": "SEI BORNA TERMINAL #4/0",
    "unit": "UN",
    "quantity": "6",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.19",
    "description": "SEI BORNA TERMINAL #3/0",
    "unit": "UN",
    "quantity": "2",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.20",
    "description": "SEI BORNA TERMINAL #2/0",
    "unit": "UN",
    "quantity": "2",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.21",
    "description": "SEI BORNA TERMINAL #2",
    "unit": "UN",
    "quantity": "26",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.22",
    "description": "SEI BORNA TERMINAL #4",
    "unit": "UN",
    "quantity": "16",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.23",
    "description": "SEI BORNA TERMINAL #8",
    "unit": "UN",
    "quantity": "28",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "2.24",
    "description": "SEI BORNA TERMINAL #10",
    "unit": "UN",
    "quantity": "6",
    "section": "ACOMETIDAS BAJA TENSION"
  },
  {
    "code": "3.1",
    "description": "SUMINISTRO TABLERO TRANSFERENCIA GENERAL ZONAS COMUNES 250 A CON ESPACION PARA MEDIDOR",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.2",
    "description": "INSTALACION TABLERO TRANSFERENCIA GENERAL ZONAS COMUNES 250 A CON ESPACION PARA MEDIDOR",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.3",
    "description": "SUMINISTRO TABLERO DISTRIBUCION NORMAL 1000A 220V MANZANA 1",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.4",
    "description": "INSTALACION TABLERO DISTRIBUCION NORMAL 1000A 220V MANZANA 1",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.5",
    "description": "SUMINISTRO TABLERO CONTADORES 4 SERVICIOS 600A 220V MANZANA 1",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.6",
    "description": "INSTALACION TABLERO CONTADORES 4 SERVICIOS 600A 220V MANZANA 1",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.7",
    "description": "SUMINISTRO TABLERO CONTADORES 5 SERVICIOS 600A 220V MANZANA 1",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.8",
    "description": "INSTALACION TABLERO CONTADORES 5 SERVICIOS 600A 220V MANZANA 1",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.15",
    "description": "SUMINISTRO TABLERO CONTADORES 6 SERVICIOS 800A 220V MANZANA 2",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.16",
    "description": "INSTALACION TABLERO CONTADORES 6 SERVICIOS 800A 220V MANZANA 2",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.19",
    "description": "SUMINISTRO TABLERO DISTRIBUCION NORMAL 1250A 220V MANZANA 3",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.20",
    "description": "INSTALACION TABLERO DISTRIBUCION NORMAL 1250A 220V MANZANA 3",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.21",
    "description": "SUMINISTRO TABLERO CONTADORES 6 SERVICIOS 600A 220V MANZANA 3",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.22",
    "description": "INSTALACION TABLERO CONTADORES 6 SERVICIOS 600A 220V MANZANA 3",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.23",
    "description": "SUMINISTRO TABLERO CONTADORES 5 SERVICIOS 600A 220V MANZANA 3",
    "unit": "UN",
    "quantity": "2",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.24",
    "description": "INSTALACION TABLERO CONTADORES 5 SERVICIOS 600A 220V MANZANA 3",
    "unit": "UN",
    "quantity": "2",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.31",
    "description": "SUMINISTRO TABLERO DISTRIBUCION NORMAL 1250A 220V MANZANA 4",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.32",
    "description": "INSTALACION TABLERO DISTRIBUCION NORMAL 1250A 220V MANZANA 4",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.33",
    "description": "SUMINISTRO TABLERO CONTADORES 6 SERVICIOS 600A 220V MANZANA 4",
    "unit": "UN",
    "quantity": "2",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.34",
    "description": "INSTALACION TABLERO CONTADORES 6 SERVICIOS 600A 220V MANZANA 4",
    "unit": "UN",
    "quantity": "2",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.35",
    "description": "SUMINISTRO TABLERO CONTADORES 5 SERVICIOS 600A 220V MANZANA 4",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.36",
    "description": "INSTALACION TABLERO CONTADORES 5 SERVICIOS 600A 220V MANZANA 4",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.43",
    "description": "SUMINISTRO TABLERO DISTRIBUCION NORMAL 1250A 220V MANZANA 5",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.44",
    "description": "INSTALACION TABLERO DISTRIBUCION NORMAL 1250A 220V MANZANA 5",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.45",
    "description": "SUMINISTRO TABLERO CONTADORES 6 SERVICIOS 600A 220V MANZANA 5",
    "unit": "UN",
    "quantity": "3",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.46",
    "description": "INSTALACION TABLERO CONTADORES 6 SERVICIOS 600A 220V MANZANA 5",
    "unit": "UN",
    "quantity": "3",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.51",
    "description": "SUMINISTRO PLANTA DE EMERGENCIA CABINADA 75 KVA 3F 220/127V CON ACCESORIOS - INCLUYE EXOSTO",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.52",
    "description": "INSTALACION PLANTA DE EMERGENCIA CABINADA 75 KVA 3F 220/127V CON ACCESORIOS - INCLUYE EXOSTO",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.59",
    "description": "CONSTRUCCION DE CAJA CON MARCO Y TAPA PARA CAJA SUBTERRANEA DE PASO TIPO A SB850 CELSIA 1.3X1.3X1.2 - INCLUYE EXCAVACION Y RETIRO DE MATERIAL SOBRANTE",
    "unit": "UN",
    "quantity": "43",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.60",
    "description": "CONSTRUCCION DE CAJA CON MARCO Y TAPA PARA CAJA SUBTERRANEA DE PASO TIPO A SB858 CELSIA 0,9X0,9X1 - INCLUYE EXCAVACION Y RETIRO DE MATERIAL SOBRANTE",
    "unit": "UN",
    "quantity": "36",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.61",
    "description": "SEI CURVA PVC 4''",
    "unit": "UN",
    "quantity": "84",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.62",
    "description": "SEI TUBERIA PVC 4'' - INCLUYE EXCAVACION Y RELLENO CON MATERIAL DE SITIO",
    "unit": "ML",
    "quantity": "475",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.63",
    "description": "SEI CAMPANA PVC 4''",
    "unit": "UN",
    "quantity": "58",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.64",
    "description": "SEI CURVA PVC 6''",
    "unit": "UN",
    "quantity": "54",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.65",
    "description": "SEI TUBERIA PVC 6'' - INCLUYE EXCAVACION Y RELLENO CON MATERIAL DE SITIO",
    "unit": "ML",
    "quantity": "3816",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.66",
    "description": "SEI CAMPANA PVC 6''",
    "unit": "UN",
    "quantity": "332",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.67",
    "description": "SEI TABLERO DE DISTRIBUCION TRIFASICO 18 CTOS",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.68",
    "description": "SUMINISTRO DE LUMINARIA NANO ST 60W VELNST60W.70NW66 7800LM 840 IP66 7P 100-277",
    "unit": "UN",
    "quantity": "45",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.69",
    "description": "SUMINISTRO DE LUMINARIA HIPLANE G2 75W VELHH75W.70NW66 11250LM 740 IP65 7P T3M 100-277 1-10V",
    "unit": "UN",
    "quantity": "6",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.70",
    "description": "INSTALACION DE LUMINARIA CON CARRO CANASTA, INCLUYE LA INSTALACION DE TODOS LOS ACCESORIOS",
    "unit": "UN",
    "quantity": "51",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.71",
    "description": "SEI POSTE CONCRETO 12MX510KGF",
    "unit": "UN",
    "quantity": "51",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.72",
    "description": "SEI ACOMETIDA 3#10 Cu AWG THHN",
    "unit": "ML",
    "quantity": "1650",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.73",
    "description": "SEI TUBERIA PVC ¾”",
    "unit": "ML",
    "quantity": "1500",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "3.74",
    "description": "SEI BREAKER BIFASICO 2X20A",
    "unit": "UN",
    "quantity": "2",
    "section": "OBRA BAJA TENSION"
  },
  {
    "code": "4.1",
    "description": "SEI ESTRUCTURA RECONECTADOR A CONJUNTO CON CRUCETA CENTRADA (INCLUYE SECCIONADOR DE CUCHILLAS, PARARRAYOS, CRUCETAS, HERRAJES, Transformador monofásico Auxiliar 0,5 KVA 13,2/0,24-0,12 Kv, GABINETE DE CONTROL)",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.2",
    "description": "SEI FUSIBLE TIPO K DE 120AMP DE 15KV",
    "unit": "UN",
    "quantity": "9",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.3",
    "description": "SEI PUESTA A TIERRA PARARRAYOS",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.4",
    "description": "SEI DE CRUCETA AUXILIAR AUTOSOPORTADA EN T 2.4M",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.5",
    "description": "SEI SOPORTE PARA CABLE MONOPOLAR",
    "unit": "UN",
    "quantity": "3",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.6",
    "description": "SEI JUEGO TERMINAL ELASTOMERICO #1/0 15 KV EXTERIOR",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.7",
    "description": "SEI BOTA TERMOENCOGIBLE TRES SALIDAS CALIBRE 1/0 AWG",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.8",
    "description": "SEI TUBERIA GALVANIZADA IMC 4\" (INCLUIR SOPORTERIA 6MTS CON 3 BANDAS COPAS DE 12\" Y 3 DE 4\" --- SOPORTE EN CHANEL CON ABRAZADERA AJUSTABLE)",
    "unit": "ML",
    "quantity": "6",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.9",
    "description": "SEI CURVA PVC 4''",
    "unit": "UN",
    "quantity": "17",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.1",
    "description": "SEI TUBERIA PVC 4'' - INCLUYE EXCAVACION Y RELLENO CON MATERIAL DE SITIO",
    "unit": "ML",
    "quantity": "1554",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.11",
    "description": "SEI CAMPANA PVC 4''",
    "unit": "UN",
    "quantity": "116",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.12",
    "description": "CONSTRUCCION DE CAJA CON MARCO Y TAPA PARA CAJA SUBTERRANEA DE PASO TIPO A SB850 CELSIA 1.3X1.3X1.2MT - INCLUYE EXCAVACION Y RETIRO DE MATERIAL SOBRANTE",
    "unit": "UN",
    "quantity": "19",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.13",
    "description": "CONSTRUCCION DE CAJA CON MARCO Y TAPA PARA CAJA SUBTERRANEA DE PASO TIPO B SB851 CELSIA 1.5X1.5X1.32MT - INCLUYE EXCAVACION Y RETIRO DE MATERIAL SOBRANTE",
    "unit": "UN",
    "quantity": "4",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.14",
    "description": "CONSTRUCCION DE CAJA CON MARCO Y TAPA PARA CAJA SUBTERRANEA DE PASO TIPO 1 SB853 CELSIA 2.6X1.5X1.2 - NO INCLUYE CONSTRUCCION DE CAJA",
    "unit": "UN",
    "quantity": "6",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.15",
    "description": "SEI BARRAJE ELASTOMERICO 4 VIAS 600A 15KV",
    "unit": "UN",
    "quantity": "18",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.16",
    "description": "SEI CONECTOR TIPO CODO #1/0 15 KV EXTERIOR",
    "unit": "UN",
    "quantity": "69",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.17",
    "description": "SUMINISTRO TRANSFORMADOR PADMOUNTED DE 75 KVA 3F 13200 / 220/127V ARM, incluye: • Juego de (3) tres unidades de fusibles ELSP. • Juego de (6) seis unidades de bujes insertos sencillos. • Juego de (3) codos de conexión con su respectiva terminal. • Juego de (3) tres codos DPS.",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.18",
    "description": "INSTALACION TRANSFORMADOR PADMOUNTED DE 75 KVA 3F 13200 / 220/127V CON ACCESORIOS. INCLUYE CONSTRUCCION DE TRAMPA DE ACEITE",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.19",
    "description": "SUMINISTRO TRANSFORMADOR PADMOUNTED DE 225 KVA 3F 13200 / 220/127V ARM, incluye: • Juego de (3) tres unidades de fusibles ELSP. • Juego de (6) seis unidades de bujes insertos sencillos. • Juego de (3) codos de conexión con su respectiva terminal. • Juego de (3) tres codos DPS.",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.2",
    "description": "INSTALACION TRANSFORMADOR PADMOUNTED DE 225 KVA 3F 13200 / 220/127V CON ACCESORIOS. INCLUYE CONSTRUCCION DE TRAMPA DE ACEITE.",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.21",
    "description": "SUMINISTRO TRANSFORMADOR PADMOUNTED DE 300 KVA 3F 13200 / 220/127V ARM, incluye: • Juego de (3) tres unidades de fusibles ELSP. • Juego de (6) seis unidades de bujes insertos sencillos. • Juego de (3) codos de conexión con su respectiva terminal. • Juego de (3) tres codos DPS.",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.22",
    "description": "INSTALACION TRANSFORMADOR PADMOUNTED DE 300 KVA 3F 13200 / 220/127V CON ACCESORIOS. INCLUYE CONSTRUCCION DE TRAMPA DE ACEITE.",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.23",
    "description": "SUMINISTRO TRANSFORMADOR PADMOUNTED DE 400 KVA 3F 13200 / 220/127V ARM, incluye: • Juego de (3) tres unidades de fusibles ELSP. • Juego de (6) seis unidades de bujes insertos sencillos. • Juego de (3) codos de conexión con su respectiva terminal. • Juego de (3) tres codos DPS.",
    "unit": "UN",
    "quantity": "3",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.24",
    "description": "INSTALACION TRANSFORMADOR PADMOUNTED DE 400 KVA 3F 13200 / 220/127V CON ACCESORIOS. INCLUYE CONSTRUCCION DE TRAMPA DE ACEITE.",
    "unit": "UN",
    "quantity": "3",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.25",
    "description": "SEI MATERIALES DELIMITACION DE SEGURIDAD EN PISO EN LA SUBESTACION",
    "unit": "GLB",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.26",
    "description": "SEI ACRILICOS Y MARCACION DE LA SUBESTACION",
    "unit": "GLB",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.27",
    "description": "SUMINISTRO CELDA DE MEDIDA INDIRECTA PARA ZONAS COMUNES INCLUYE 3 TP'S 13200/120V CLASE 0.5, 3 TC'S 1-5/5A CLASE 0.5S, MEDIDOR ELECTRONICO INDIRECTO 4 CUADRANTES CLASE 0.5S",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "4.28",
    "description": "INSTALACION CELDA DE MEDIDA INDIRECTA PARA ZONAS COMUNES INCLUYE 3 TP'S 13200/120V CLASE 0.5, 3 TC'S 1-5/5A CLASE 0.5S, MEDIDOR ELECTRONICO INDIRECTO 4 CUADRANTES CLASE 0.5S",
    "unit": "UN",
    "quantity": "1",
    "section": "OBRA MEDIA TENSION Y SUBESTACIONES"
  },
  {
    "code": "5.1",
    "description": "SEI MALLA A TIERRA 5X4 MTS 4 ELECTRODOS EN CABLE BD #2/0, CUADRICULA 1MTS SEPARACION, INCLUYE EXCAVACIÓN INSTALACION Y RELLENO CON MATERIAL DE SITIO Y CONSTRUCCION DE CAJAS DE INSPECCION DE 30X30",
    "unit": "UN",
    "quantity": "6",
    "section": "MALLA  A TIERRA"
  },
  {
    "code": "5.2",
    "description": "SEI CABLE BD #2/0 PARA EQUIPOTENCIALIZACIÓN",
    "unit": "ML",
    "quantity": "18",
    "section": "MALLA  A TIERRA"
  },
  {
    "code": "6.1",
    "description": "SUMINISTRO CAJA CON MARCO Y TAPA PARA CAJA SUBTERRANEA DE PASO TIPO A SB858 CELSIA 0,9X0,9X1 - INCLUYE CONSTRUCCION DE CAJA, EXCAVACION Y RETIRO DE MATERIAL SOBRANTE",
    "unit": "UN",
    "quantity": "43",
    "section": "REDES DE DATOS"
  },
  {
    "code": "6.2",
    "description": "SEI CURVA PVC 4''",
    "unit": "UN",
    "quantity": "70",
    "section": "REDES DE DATOS"
  },
  {
    "code": "6.3",
    "description": "SEI TUBERIA PVC 4'' - INCLUYE EXCAVACION Y RELLENO CON MATERIAL DE SITIO",
    "unit": "ML",
    "quantity": "1106",
    "section": "REDES DE DATOS"
  },
  {
    "code": "6.4",
    "description": "SEI CAMPANA PVC 4''",
    "unit": "UN",
    "quantity": "202",
    "section": "REDES DE DATOS"
  },
  {
    "code": "7",
    "description": "CERTIFICACION RETIE DISTRIBUCION TRANSFORMACION Y USO FINAL",
    "unit": "UND",
    "quantity": "1",
    "section": "REDES DE DATOS"
  }
];

export const getActaItemOptionLabel = (item: ActaItem): string =>
  `${item.code} · ${item.description}${item.unit ? ` · ${item.unit}` : ''}${item.quantity ? ` · ${item.quantity}` : ''}`;

export const getActaItemKey = (item: ActaItem): string => `${item.code}::${item.description}`;
