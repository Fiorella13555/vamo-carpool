import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-xs ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
