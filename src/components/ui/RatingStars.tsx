import { Star } from "lucide-react";

interface RatingStarsProps {
  value: number;
  max?: number;
  size?: number;
  /** Si se pasa, las estrellas se vuelven botones y esto se llama al elegir una calificación. */
  onChange?: (value: number) => void;
  "aria-label"?: string;
}

// Lectura (value fijo) o entrada (con onChange) con el mismo componente.
// El número siempre se puede mostrar al lado por el llamador -- esto nunca
// es el único indicador de la calificación (accesibilidad: no solo color).
export function RatingStars({ value, max = 5, size = 18, onChange, ...rest }: RatingStarsProps) {
  const interactive = !!onChange;
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <span className="inline-flex items-center gap-0.5" role={interactive ? "radiogroup" : "img"} aria-label={rest["aria-label"] ?? `${value} de ${max} estrellas`}>
      {stars.map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            key={n}
            className={filled ? "fill-amber-400 text-amber-500" : "fill-none text-border-default"}
            width={size}
            height={size}
            aria-hidden="true"
          />
        );
        if (!interactive) return star;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === Math.round(value)}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className="rounded-sm p-0.5"
          >
            {star}
          </button>
        );
      })}
    </span>
  );
}
