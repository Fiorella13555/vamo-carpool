import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:bg-bg-sunken disabled:text-text-disabled disabled:shadow-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-gradient-button text-navy-900 shadow-sm",
  secondary: "border-[1.5px] border-border-default bg-bg-surface text-navy-900 hover:bg-bg-sunken",
  danger: "bg-error text-white hover:bg-error/90",
};

// Botones primario/secundario/peligro/deshabilitado/cargando — los 5
// estados que pidió la propuesta, todos en un componente.
export function Button({ variant = "primary", loading, disabled, children, className, ...rest }: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className ?? ""}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40" strokeDashoffset="12" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
