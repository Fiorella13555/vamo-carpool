import type { HTMLAttributes, ReactNode } from "react";

interface GradientHeroProps extends HTMLAttributes<HTMLDivElement> {
  /** "strong" = login/registro/verificación/admin. "soft" = cabecera del home, tarjeta de viaje en curso. */
  intensity?: "strong" | "soft";
  children: ReactNode;
}

// Superficie de degradado reutilizable. Nunca va detrás de texto largo,
// formularios densos ni tablas -- eso vive siempre en una tarjeta clara
// encima o debajo de este contenedor.
export function GradientHero({ intensity = "strong", children, className, ...rest }: GradientHeroProps) {
  return (
    <div
      className={`safe-top safe-x relative overflow-hidden text-white ${
        intensity === "strong" ? "bg-gradient-hero" : "bg-gradient-soft"
      } ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
