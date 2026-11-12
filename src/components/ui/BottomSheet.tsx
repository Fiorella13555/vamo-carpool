import type { ReactNode } from "react";

interface BottomSheetProps {
  children: ReactNode;
  className?: string;
}

// Panel fijo al fondo de la pantalla, sobre el mapa (Home del pasajero).
// Sin gesto de arrastre todavía -- es la versión estática; arrastrar para
// expandir queda como mejora futura, no bloquea el uso (el panel ya
// scrollea su contenido).
export function BottomSheet({ children, className }: BottomSheetProps) {
  return (
    <div
      className={`safe-bottom safe-x absolute inset-x-0 bottom-[88px] max-h-[60dvh] overflow-y-auto rounded-t-xl bg-bg-surface pt-3 shadow-md ${className ?? ""}`}
    >
      <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border-default" aria-hidden="true" />
      {children}
    </div>
  );
}
