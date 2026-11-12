// Debe calzar con el check de la migración: placa ~ '^[A-Z0-9-]{5,8}$'.
// Acepta formatos comunes en Perú (ej. ABC-123, ABC-1234) sin ser demasiado
// estricto (MVP).
export function isValidPlaca(placa: string): boolean {
  return /^[A-Za-z0-9-]{5,8}$/.test(placa.trim());
}
