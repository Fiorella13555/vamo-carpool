import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";
import { StatusScreen } from "../../components/ui";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <p className="p-6 text-text-secondary">Cargando...</p>;
  if (!session) return <Navigate to="/bienvenida" replace />;

  if (!profile || profile.verification_status === "pending") {
    return (
      <StatusScreen
        icon={Loader2}
        title="Verificando tu identidad"
        description="Espera un momento, ya casi terminamos."
      />
    );
  }

  if (profile.verification_status === "rejected") {
    return (
      <StatusScreen
        icon={ShieldAlert}
        title="No pudimos verificar tu identidad"
        description="Revisa tu DNI o contacta al administrador si crees que es un error."
      />
    );
  }

  return <>{children}</>;
}
