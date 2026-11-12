import { useEffect, useId, useRef, useState } from "react";
import { useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { isInLima } from "../lib/geo";
import type { LatLng } from "../lib/geo";

export function LocationSearch({ label, point, onSelect, onClear, onMap }: {
  label: string; point: LatLng | null;
  onSelect: (point: LatLng) => void; onClear: () => void; onMap: () => void;
}) {
  const library = useMapsLibrary("places");
  const id = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const session = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  useEffect(() => {
    if (!library || !open || query.trim().length < 3) return;
    const token = version.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        session.current ??= new library.AutocompleteSessionToken();
        const result = await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(), sessionToken: session.current,
          includedRegionCodes: ["pe"], language: "es", region: "pe",
          locationRestriction: { south: -12.4, north: -11.65, west: -77.2, east: -76.7 },
        });
        if (token !== version.current) return;
        setSuggestions(result.suggestions.flatMap(s => s.placePrediction ? [s.placePrediction] : []));
        setActive(-1);
      } catch {
        if (token === version.current) setError("No pudimos buscar direcciones. Intenta nuevamente o elige en el mapa.");
      } finally { if (token === version.current) setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); };
  }, [library, query, open]);
  useEffect(() => () => { version.current++; }, []);
  async function select(prediction: google.maps.places.PlacePrediction) {
    const token = ++version.current;
    setQuery(prediction.text.toString()); setOpen(false); setSuggestions([]); setError(null); setLoading(true);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["location"] });
      if (token !== version.current) return;
      const location = place.location?.toJSON();
      if (!location || !isInLima(location)) throw new Error();
      onSelect(location);
    } catch {
      if (token === version.current) setError("No pudimos seleccionar ese lugar. Elige otra opción o usa el mapa.");
    } finally {
      session.current = null;
      if (token === version.current) setLoading(false);
    }
  }
  const visible = open && suggestions.length > 0;
  return <section className="flex flex-col gap-1.5" onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { version.current++; setOpen(false); setLoading(false); }
  }}>
    <label htmlFor={id} className="text-sm font-bold text-text-primary">{label}</label>
    <input id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={visible}
      aria-controls={`${id}-options`} aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined}
      placeholder="Escribe una dirección o un lugar" value={query}
      className="min-h-12 w-full rounded-lg border border-border-default bg-bg-surface px-3 text-base text-text-primary focus:outline-2 focus:outline-accent-700"
      onFocus={() => setOpen(true)} onChange={e => {
        version.current++; setQuery(e.target.value); setSuggestions([]); setActive(-1); setOpen(true); setLoading(false); setError(null); onClear();
      }} onKeyDown={e => {
        if (e.key === "Escape") { version.current++; setOpen(false); setLoading(false); }
        if (visible && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault(); setActive(previous => (previous + (e.key === "ArrowDown" ? 1 : suggestions.length - 1) + suggestions.length) % suggestions.length);
        }
        if (visible && e.key === "Enter") { e.preventDefault(); if (active >= 0) void select(suggestions[active]); }
      }}/>
    {visible && <div className="rounded-lg border border-border-default bg-bg-surface shadow-md">
      <ul id={`${id}-options`} role="listbox" aria-label={`Sugerencias de ${label.toLowerCase()}`}>
        {suggestions.map((prediction, index) => <li key={prediction.placeId} role="option" id={`${id}-${index}`} aria-selected={active === index}>
          <button type="button" tabIndex={-1} className={`min-h-12 w-full border-b border-border-subtle px-3 py-3 text-left text-sm hover:bg-bg-sunken ${active === index ? 'bg-bg-sunken' : ''}`}
            onMouseDown={e => e.preventDefault()} onClick={() => void select(prediction)}>{prediction.text.toString()}</button>
        </li>)}
      </ul><p className="px-3 py-2 text-right text-xs text-text-secondary">Google Maps</p>
    </div>}
    {loading && <p role="status" className="text-xs text-text-secondary">Buscando dirección…</p>}
    {!library && <p role="status" className="text-xs text-text-secondary">Cargando búsqueda de direcciones…</p>}
    {library && open && query.trim().length >= 3 && !loading && !error && !suggestions.length && <p className="text-xs text-text-secondary">Prueba con la calle, el distrito o un lugar conocido.</p>}
    {point && <p className="text-xs text-text-secondary">Ubicación seleccionada ✓</p>}
    {error && <p role="alert" className="text-xs text-error">{error}</p>}
    <button type="button" className="min-h-11 text-left text-sm font-semibold text-accent-700" onClick={() => {
      version.current++; setOpen(false); setLoading(false); session.current = null; onMap();
    }}>Elegir {label.toLowerCase()} en el mapa ↗</button>
  </section>;
}

export function FitJourney({ origin, destination, route, overlay = true }: { origin:LatLng|null; destination:LatLng|null; route?:LatLng[]|null; overlay?:boolean }) {
  const map = useMap();
  const frame=JSON.stringify({origin,destination,route,overlay});
  useEffect(() => {
    const {origin,destination,route,overlay}=JSON.parse(frame) as {origin:LatLng|null;destination:LatLng|null;route?:LatLng[]|null;overlay:boolean};
    if (!map || (!origin && !destination)) return;
    const fit = () => {
      if (origin && destination) {
        const bounds = new google.maps.LatLngBounds();
        for (const point of route?.length ? route : [origin, destination]) bounds.extend(point);
        const height = map.getDiv().clientHeight;
        map.fitBounds(bounds, {top:40,left:32,right:32,bottom:overlay?Math.min(height*.45,300):40});
      } else { map.panTo((origin ?? destination)!); map.setZoom(15); }
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(map.getDiv());
    return () => observer?.disconnect();
  }, [map,frame]);
  return null;
}
