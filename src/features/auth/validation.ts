export function isValidDni(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}
