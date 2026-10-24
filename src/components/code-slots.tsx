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
  length = 6,
  characterSet = "numeric",
  autoComplete = "one-time-code",
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  label: string;
  describedBy?: string;
  length?: number;
  characterSet?: "numeric" | "alphanumeric";
  autoComplete?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [cursor, setCursor] = useState(value.length);
  const characters = value.split("");
  const alphanumeric = characterSet === "alphanumeric";
  const clean = (text: string) => alphanumeric
    ? text.toUpperCase().replace(/[^A-Z0-9]/g, "")
    : text.replace(/\D/g, "");
  const update = (input: HTMLInputElement, next: string, position: number) => {
    onChange(next);
    setCursor(position);
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(position, position);
    });
  };

  return (
    <div data-complete={value.length === length} className={cn("relative w-full", disabled && "opacity-60")}>
      {/* 1 real semantic input underneath to preserve paste, mobile OTP autofill, accessibility */}
      <input
        ref={inputRef}
        id="code"
        name="code"
        type="text"
        inputMode={alphanumeric ? "text" : "numeric"}
        autoComplete={autoComplete}
        autoCapitalize={alphanumeric ? "characters" : undefined}
        autoCorrect="off"
        spellCheck={false}
        pattern={alphanumeric ? `[A-Z0-9]{${length}}` : `[0-9]{${length}}`}
        maxLength={length}
        required
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const input = e.currentTarget;
          const position = clean(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
          update(input, clean(input.value).slice(0, length), Math.min(position, length));
        }}
        onPaste={(e) => {
          e.preventDefault();
          const input = e.currentTarget;
          const start = input.selectionStart ?? value.length;
          const end = input.selectionEnd ?? start;
          const inserted = clean(e.clipboardData.getData("text")).slice(0, length - (value.length - (end - start)));
          update(input, value.slice(0, start) + inserted + value.slice(end), start + inserted.length);
        }}
        onFocus={(e) => { setIsFocused(true); setCursor(e.currentTarget.selectionStart ?? value.length); }}
        onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? value.length)}
        onBlur={() => setIsFocused(false)}
        aria-label={label}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        className="absolute inset-0 h-full w-full cursor-text opacity-0 z-10"
      />

      {/* Visual slots never receive focus; the native input owns editing and selection. */}
      <div
        aria-hidden="true"
        data-code-slots
        className={cn("grid w-full select-none", length > 6 ? "gap-1 sm:gap-1.5" : "gap-2 sm:gap-2.5")}
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {Array.from({ length }).map((_, i) => {
          const char = characters[i] ?? "";
          const isActive =
            isFocused && !disabled && i === Math.min(cursor, length - 1);

          return (
            <div
              key={i}
              data-active={isActive}
              className={cn(
                "flex h-[52px] min-w-0 items-center justify-center border bg-background font-mono font-semibold transition-[border-color,background-color,box-shadow] duration-150 text-foreground motion-reduce:transition-none",
                length > 6 ? "rounded-lg text-base sm:text-lg" : "rounded-[10px] text-xl",
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
