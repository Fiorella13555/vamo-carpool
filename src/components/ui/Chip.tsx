import type { ReactNode } from "react";

export type ChipTone = "info" | "success" | "warning" | "error" | "neutral";

const tones: Record<ChipTone, string> = {
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  neutral: "bg-bg-sunken text-text-secondary",
};

interface ChipProps {
  tone?: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Insignia de estado. Siempre con texto, nunca solo color — así nadie
// depende de distinguir tonos para entender qué significa.
export function Chip({ tone = "neutral", icon, children, className }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${tones[tone]} ${className ?? ""}`}
    >
      {icon}
      {children}
    </span>
  );
}
