import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const parents: Record<string, string> = {
  "/register": "/login", "/login": "/bienvenida", "/recuperar": "/login",
  "/restablecer": "/login", "/conductor/publicar": "/conductor/mis-viajes",
  "/conductor/vehiculo": "/", "/perfil/editar": "/",
};
export function BackNavigation() {
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  if (pathname === "/" || pathname === "/bienvenida") return null;
  return <div className="safe-x sticky top-0 z-40 flex h-[60px] shrink-0 items-center border-b border-border-subtle bg-bg-surface px-4 py-2">
    <button type="button" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-navy-900 hover:bg-bg-sunken"
      onClick={() => { if (key !== "default") navigate(-1); else navigate(parents[pathname] ?? "/"); }}>
      <ArrowLeft size={20} aria-hidden="true"/>Volver
    </button>
  </div>;
}
