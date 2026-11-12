import { useEffect, useRef, useState } from "react";
import { useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { isInLima } from "../lib/geo";
import type { LatLng } from "../lib/geo";

export function LocationSearch({ label, point, onSelect, onClear, onMap }: {
  label: string; point: LatLng | null;
  onSelect: (point: LatLng) => void; onClear: () => void; onMap: () => void;
}) {
  const library = useMapsLibrary("places");
  const host = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const callbacks = useRef({onSelect, onClear});
  callbacks.current = {onSelect, onClear};
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!library || !host.current) return;
    const widget = new library.PlaceAutocompleteElement({
      includedRegionCodes: ["pe"],
      locationRestriction: { south:-12.4, north:-11.65, west:-77.2, east:-76.7 },
    });
    widgetRef.current = widget;
    widget.setAttribute("placeholder", label);
    widget.setAttribute("aria-label", label);
    widget.style.width = "100%";
    let version = 0;
    const clear = () => { version++; callbacks.current.onClear(); setError(null); };
    const select = async (event: Event) => {
      const token = ++version;
      callbacks.current.onClear();
      try {
        const prediction = (event as Event & {placePrediction: google.maps.places.PlacePrediction}).placePrediction;
        const place = prediction.toPlace();
        await place.fetchFields({ fields:["location"] });
        if (token !== version) return;
        const location = place.location?.toJSON();
        if (!location || !isInLima(location)) throw new Error("Selecciona un lugar dentro de Lima Metropolitana.");
        callbacks.current.onSelect(location); setError(null);
      } catch { if (token === version) setError("No pudimos seleccionar ese lugar. Prueba otro resultado o elige en el mapa."); }
    };
    const failure = () => setError("La búsqueda de direcciones no está disponible. Puedes elegir en el mapa.");
    widget.addEventListener("input", clear);
    widget.addEventListener("gmp-select", select);
    widget.addEventListener("gmp-error", failure);
    host.current.append(widget);
    return () => { version++; widget.removeEventListener("input",clear); widget.removeEventListener("gmp-select",select); widget.removeEventListener("gmp-error",failure); widget.remove(); widgetRef.current = null; };
  }, [library, label]);
  return <section className="flex flex-col gap-1.5">
    <p className="text-sm font-bold text-text-primary">{label}</p>
    <div ref={host}/>
    {!library && <p className="text-xs text-text-secondary">Cargando búsqueda de direcciones…</p>}
    {point && <p className="text-xs text-text-secondary">Punto seleccionado: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>}
    {error && <p role="alert" className="text-xs text-error">{error}</p>}
    <button type="button" className="min-h-11 text-left text-sm font-semibold text-accent-700" onClick={()=>{if(widgetRef.current) widgetRef.current.value=""; onMap();}}>Elegir {label.toLowerCase()} en el mapa ↗</button>
  </section>;
}

export function FitJourney({ origin, destination }: { origin:LatLng|null; destination:LatLng|null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || (!origin && !destination)) return;
    if (origin && destination) {
      const bounds = new google.maps.LatLngBounds(); bounds.extend(origin); bounds.extend(destination);
      map.fitBounds(bounds, {top:60,left:30,right:30,bottom:Math.min(window.innerHeight*.55,400)});
    } else { map.panTo((origin ?? destination)!); map.setZoom(15); }
  }, [map,origin,destination]);
  return null;
}
