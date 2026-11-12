import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "./api";
import { isValidDni } from "./validation";
import { Logo } from "../../components/Logo";
import { Button, GradientHero, Input } from "../../components/ui";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dni, setDni] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [isPassenger, setIsPassenger] = useState(true);
  const [isDriver, setIsDriver] = useState(false);
  const [acceptsPrivacy, setAcceptsPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidDni(dni)) {
      setError("El DNI debe tener exactamente 8 dígitos.");
      return;
    }
    if (!isPassenger && !isDriver) {
      setError("Elige al menos un rol: pasajero o conductor.");
      return;
    }
    if (!acceptsPrivacy) {
      setError("Debes aceptar el tratamiento de tus datos personales para registrarte.");
      return;
    }

    setSubmitting(true);
    try {
      await registerUser({
        email,
        password,
        dni,
        nombres,
        apellidos,
        sexo,
        isPassenger,
        isDriver,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg-page pb-28">
      <GradientHero className="flex flex-col items-center gap-2 py-8">
        <Logo size={36} wordmarkColor="#FFFFFF" />
        <p className="text-sm font-semibold text-white/85">Crea tu cuenta</p>
      </GradientHero>

      <form onSubmit={handleSubmit} className="vamo-form mx-auto mt-3 flex max-w-md flex-col gap-4">
        <Input
          label="DNI *"
          type="text"
          required
          inputMode="numeric"
          maxLength={8}
          pattern="[0-9]{8}"
          placeholder="8 dígitos"
          autoComplete="off"
          aria-describedby="dni-privacy"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
        />
        <p id="dni-privacy" className="-mt-2 text-xs text-text-secondary">Obligatorio. Tu DNI no se muestra en tu perfil público.</p>
        <Input label="Nombres" required value={nombres} onChange={(e) => setNombres(e.target.value)} />
        <Input label="Apellidos" required value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
        <Input label="Correo" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Contraseña"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />


        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-text-primary">Sexo</legend>
          <div className="flex gap-5">
            <label className="flex items-center gap-2 text-base text-text-primary">
              <input type="radio" name="sexo" checked={sexo === "M"} onChange={() => setSexo("M")} className="size-5 accent-accent-700" />
              Masculino
            </label>
            <label className="flex items-center gap-2 text-base text-text-primary">
              <input type="radio" name="sexo" checked={sexo === "F"} onChange={() => setSexo("F")} className="size-5 accent-accent-700" />
              Femenino
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-text-primary">Rol (puedes elegir ambos)</legend>
          <div className="flex gap-5">
            <label className="flex items-center gap-2 text-base text-text-primary">
              <input
                type="checkbox"
                checked={isPassenger}
                onChange={(e) => setIsPassenger(e.target.checked)}
                className="size-5 accent-accent-700"
              />
              Pasajero
            </label>
            <label className="flex items-center gap-2 text-base text-text-primary">
              <input
                type="checkbox"
                checked={isDriver}
                onChange={(e) => setIsDriver(e.target.checked)}
                className="size-5 accent-accent-700"
              />
              Conductor
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5 rounded-lg bg-info-soft p-4">
          <legend className="text-sm font-bold text-text-primary">Privacidad</legend>
          <p className="text-sm text-text-secondary">
            Tu DNI y apellidos se usan para verificar tu identidad y no se muestran a otros usuarios. Tu nombre de pila sí aparece en tu perfil público. Puedes pedir que se eliminen
            escribiéndonos.
          </p>
          <label className="flex items-start gap-2.5 text-sm font-medium text-text-primary">
            <input
              type="checkbox"
              checked={acceptsPrivacy}
              onChange={(e) => setAcceptsPrivacy(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-accent-700"
            />
            Acepto el tratamiento de mis datos personales conforme a la Ley N° 29733 (Ley de Protección de Datos
            Personales).
          </label>
        </fieldset>

        {error && <p className="rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}

        <Button type="submit" loading={submitting} className="mt-1 w-full">
          Crear cuenta
        </Button>

        <p className="pb-4 text-center text-sm text-text-secondary">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-bold text-accent-700">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
