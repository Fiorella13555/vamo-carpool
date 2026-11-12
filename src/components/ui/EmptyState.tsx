import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="mb-1 inline-flex size-12 items-center justify-center rounded-full bg-bg-sunken text-text-secondary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="font-bold text-text-primary">{title}</p>
      {description && <p className="max-w-xs text-sm text-text-secondary">{description}</p>}
      {action}
    </div>
  );
}
