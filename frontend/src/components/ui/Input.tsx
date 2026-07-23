"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Errors render inline and are wired to the input via aria-describedby +
 * aria-invalid. This is the replacement for the alert()-based validation the
 * auth pages currently use.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-foreground text-sm font-medium">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          "bg-background border-border text-foreground placeholder:text-muted-foreground",
          "h-10 w-full rounded-md border px-3 text-sm transition-colors",
          "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
          className,
        )}
        {...props}
      />
      {message && (
        <p
          id={messageId}
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {message}
        </p>
      )}
    </div>
  );
});

export default Input;
