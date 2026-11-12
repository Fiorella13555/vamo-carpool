// Modo prueba: activado con VITE_TEST_MODE=true para la validación con
// personas reales que pueden no estar físicamente sobre la ruta. Permite
// fijar una ubicación manual (en vez de navigator.geolocation) y sube la
// tolerancia de cercanía por defecto.
export const TEST_MODE = import.meta.env.VITE_TEST_MODE === "true";

const DEFAULT_TEST_TOLERANCE_M = 2000;

export const TEST_TOLERANCE_M = TEST_MODE
  ? Number(import.meta.env.VITE_TEST_TOLERANCE_M) || DEFAULT_TEST_TOLERANCE_M
  : undefined;
