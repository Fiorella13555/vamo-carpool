import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "./api";
import { Logo } from "../../components/Logo";
import { Button, GradientHero, Input } from "../../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginUser(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GradientHero className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo size={44} wordmarkColor="#FFFFFF" />
      </div>

      <div className="w-full max-w-sm rounded-xl bg-bg-surface p-6 shadow-md">
        <h1 className="mb-5 text-xl font-extrabold text-text-primary">Iniciar sesión</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Link to="/recuperar" className="text-right text-sm font-bold text-accent-700 underline">¿Olvidaste tu contraseña?</Link>

          {error && (
            <p className="rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>
          )}

          <Button type="submit" loading={submitting} className="mt-1 w-full">
            Iniciar sesión
          </Button>
        </form>
      </div>

      <p className="mt-6 text-sm text-white/85">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="font-bold text-white underline underline-offset-2">
          Regístrate
        </Link>
      </p>
    </GradientHero>
  );
}
