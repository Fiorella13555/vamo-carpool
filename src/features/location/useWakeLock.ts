import { useEffect, useRef } from "react";

// Mantiene la pantalla encendida mientras se comparte ubicación en vivo
// (si no, iOS/Android apagan la pantalla y watchPosition se vuelve errático
// en segundo plano). Safari en iPhone soporta la Screen Wake Lock API desde
// iOS 16.4; si no está disponible, no hace nada (no es crítico, solo UX).
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let released = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (released) {
          await lock.release();
          return;
        }
        lockRef.current = lock;
      } catch {
        // El usuario puede negar el permiso o el navegador no soportarlo en
        // este contexto (ej. pestaña en segundo plano); no es un error fatal.
      }
    }

    // El wake lock se libera solo cuando la pestaña pasa a segundo plano;
    // hay que volver a pedirlo al regresar (ej. el usuario revisa otra app
    // un momento y vuelve a Safari).
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        acquire();
      }
    }

    acquire();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
