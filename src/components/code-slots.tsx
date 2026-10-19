"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function CodeSlots({
  value,
  onChange,
  disabled,
  hasError,
  inputRef,
  label,
  describedBy,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  label: string;
  describedBy?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const digits = value.split("");

  return (
    <div className="relative w-full">
      {/* 1 real semantic input underneath to preserve paste, mobile OTP autofill, accessibility */}
      <input
        ref={inputRef}
        id="code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(clean);
        }}
        onPaste={(e) => {
          e.preventDefault();
          const input = e.currentTarget;
          const digits = e.clipboardData.getData("text").replace(/\D/g, "");
          const start = input.selectionStart ?? value.length;
          const end = input.selectionEnd ?? start;
          const inserted = digits.slice(0, 6 - (value.length - (end - start)));
          onChange(value.slice(0, start) + inserted + value.slice(end));
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        aria-label={label}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        className="absolute inset-0 h-full w-full cursor-text opacity-0 z-10 select-none"
      />

      {/* 6 clean visual code slots */}
      <div
        aria-hidden="true"
        className="grid grid-cols-6 gap-2 sm:gap-2.5 w-full select-none"
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const char = digits[i] ?? "";
          const isActive =
            isFocused && (digits.length === i || (digits.length === 6 && i === 5));

          return (
            <div
              key={i}
              className={cn(
                "flex h-[52px] items-center justify-center rounded-[10px] border bg-background font-mono text-xl font-semibold transition-all duration-150 text-foreground",
                hasError
                  ? isActive
                    ? "border-destructive ring-3 ring-destructive/20 bg-destructive/5 text-destructive"
                    : "border-destructive text-destructive bg-destructive/5"
                  : isActive
                  ? "border-brand ring-3 ring-brand/20 bg-background"
                  : char
                  ? "border-foreground/30 bg-background"
                  : "border-border bg-subtle/30 text-fg-secondary"
              )}
            >
              {char}
            </div>
          );
        })}
      </div>
    </div>
  );
}
