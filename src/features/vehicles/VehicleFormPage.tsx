import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchMyVehicle, upsertVehicle } from "./api";
import { isValidPlaca } from "./validation";
import { Button, Card, Input } from "../../components/ui";

export function VehicleFormPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [color, setColor] = useState("");
  const [asientos, setAsientos] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchMyVehicle(profile.id)
      .then((vehicle) => {
        if (vehicle) {
          setPlaca(vehicle.placa);
          setModelo(vehicle.modelo);
          setColor(vehicle.color);
          setAsientos(vehicle.asientos);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar tu vehículo."))
      .finally(() => setLoading(false));
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPlaca(placa)) {
      setError("La placa no es válida (ej. ABC-123).");
      return;
    }
    if (!modelo.trim() || !color.trim()) {
      setError("Indica el modelo y el color del vehículo.");
      return;
    }
    if (!profile) return;

    setSubmitting(true);
    try {
      await upsertVehicle({ driverId: profile.id, placa, modelo: modelo.trim(), color: color.trim(), asientos });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el vehículo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="p-6 text-text-secondary">Cargando...</p>;

  return (
    <div className="safe-x mx-auto min-h-dvh max-w-md bg-bg-page pt-8 pb-28">
      <h1 className="mb-1 text-xl font-extrabold text-text-primary">Mi vehículo</h1>
      <p className="mb-5 text-sm text-text-on-dark-muted">
        Debes registrar tu vehículo antes de publicar un viaje. Tus pasajeros verán estos datos para identificar el
        carro.
      </p>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Placa" value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC-123" />
          <Input
            label="Modelo"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            placeholder="Toyota Yaris"
          />
          <Input label="Color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Gris" />
          <Input
            label="Asientos para pasajeros"
            type="number"
            min={1}
            max={6}
            value={asientos}
            onChange={(e) => setAsientos(Number(e.target.value))}
          />

          {error && <p className="rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}
          {saved && <p className="rounded-sm bg-success-soft px-3 py-2 text-sm font-medium text-success">Vehículo guardado.</p>}

          <div className="flex flex-col gap-2">
            <Button type="submit" loading={submitting}>
              Guardar vehículo
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/conductor/publicar")}>
              Ir a publicar viaje
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
