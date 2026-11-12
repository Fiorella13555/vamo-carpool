import { useEffect, useState } from "react";

// Distingue "perdí mi conexión" (este dispositivo) de "la otra persona no
// manda posición nueva" (se ve con el tiempo transcurrido desde recorded_at,
// ver useLiveLocationViewers). Ambos casos se muestran igual en el mapa
// ("última posición hace X seg"), pero este aviso es más específico cuando
// es el propio dispositivo el que está sin conexión.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
