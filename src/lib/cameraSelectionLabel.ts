export function getCameraSelectionLabel(cameraCode?: string, cameraName?: string): string {
  const code = cameraCode?.trim() || 'Cámara sin código';
  const name = cameraName?.trim();

  return name && name !== code ? `${code} · ${name}` : code;
}
