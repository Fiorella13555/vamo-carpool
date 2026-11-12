import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { triggerWatchlistScreening, updateOwnNames } from "./api";
import { Button, Card, Input } from "../../components/ui";

export function EditProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [nombres, setNombres] = useState(profile?.nombres ?? "");
  const [apellidos, setApellidos] = useState(profile?.apellidos ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombres.trim() || !apellidos.trim()) {
      setError("Completa nombres y apellidos.");
      return;
    }
    if (!profile) return;

    const changed = nombres.trim() !== profile.nombres || apellidos.trim() !== profile.apellidos;

    setSubmitting(true);
    try {
      await updateOwnNames(profile.id, { nombres: nombres.trim(), apellidos: apellidos.trim() });
      // Si cambió el nombre, se vuelve a tamizar contra el watchlist (ver
      // CLAUDE.md): un nombre nuevo es evidencia nueva.
      if (changed) await triggerWatchlistScreening();
      await refreshProfile();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="safe-x mx-auto min-h-dvh max-w-md bg-bg-page pt-8 pb-28">
      <h1 className="mb-5 text-xl font-extrabold text-text-primary">Editar mi perfil</h1>
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Nombres" required value={nombres} onChange={(e) => setNombres(e.target.value)} />
          <Input label="Apellidos" required value={apellidos} onChange={(e) => setApellidos(e.target.value)} />

          {error && <p className="rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" loading={submitting} className="flex-1">
              Guardar cambios
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/")}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
