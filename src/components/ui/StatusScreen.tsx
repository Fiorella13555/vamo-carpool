import type { LucideIcon } from "lucide-react";
import { GradientHero } from "./GradientHero";

interface StatusScreenProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Pantalla completa para "verificando tu cuenta", "en revisión",
// "estamos verificando tu información" (watchlist), etc. Mensaje siempre
// neutro y amable -- nunca acusatorio. Se usa en la Parte 2 para
// reemplazar los mensajes sueltos en ProtectedRoute/HomePage/etc.
export function StatusScreen({ icon: Icon, title, description }: StatusScreenProps) {
  return (
    <GradientHero className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-white/15">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="max-w-sm text-white/80">{description}</p>
    </GradientHero>
  );
}
