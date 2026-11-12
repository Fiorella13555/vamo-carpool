import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <p>Cargando...</p>;
  if (!session) return <Navigate to="/login" replace />;
  // profile todavía puede ser null un instante después de loading=false
  // (loadProfile en AuthContext no se espera antes de bajar loading): se
  // trata como "todavía cargando", no como "no es admin", para no
  // redirigir antes de tiempo (mismo problema que evita ProtectedRoute).
  if (!profile) return <p>Cargando...</p>;
  if (!profile.is_admin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
