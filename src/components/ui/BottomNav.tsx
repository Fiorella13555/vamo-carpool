import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface BottomNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface BottomNavProps {
  items: BottomNavItem[];
}

// Barra inferior mobile-first. `end` en NavLink evita que "/" quede activo
// en cualquier ruta.
export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="vamo-bottom safe-bottom safe-x fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle">
      <div className="mx-auto flex max-w-md gap-1 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold ${
                isActive ? "bg-accent-50 text-accent-700" : "text-text-secondary"
              }`
            }
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
