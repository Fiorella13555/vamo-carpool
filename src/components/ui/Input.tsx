import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldBase =
  "min-h-11 w-full rounded-sm border-[1.5px] border-border-default bg-bg-surface px-3.5 py-3 text-base text-text-primary placeholder:text-text-disabled focus-visible:border-accent-700";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// Campo con estado de error — texto siempre a 16px (si no, Safari hace
// zoom al enfocar en iPhone).
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-bold text-text-primary">
          {label}
        </label>
      )}
      <input
        id={fieldId}
        ref={ref}
        className={`${fieldBase} ${error ? "border-error" : ""} ${className ?? ""}`}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      />
      {error && (
        <span id={`${fieldId}-error`} className="text-xs font-semibold text-error">
          {error}
        </span>
      )}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-bold text-text-primary">
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        ref={ref}
        className={`${fieldBase} ${error ? "border-error" : ""} ${className ?? ""}`}
        aria-invalid={!!error || undefined}
        {...rest}
      />
      {error && <span className="text-xs font-semibold text-error">{error}</span>}
    </div>
  );
});
