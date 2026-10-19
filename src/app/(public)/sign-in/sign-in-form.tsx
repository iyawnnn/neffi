"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/auth/client";
import { GoogleLogo } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Step = "email" | "code";

export { inputClass };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function OtpSlots({
  value,
  onChange,
  disabled,
  hasError,
  inputRef,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
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
        pattern="[0-9]*"
        maxLength={6}
        required
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(clean);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        aria-label="6-digit verification code"
        aria-invalid={hasError}
        aria-describedby={hasError ? "code-error" : undefined}
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
                  ? "border-destructive text-destructive bg-destructive/5"
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

export function SignInForm({
  next,
  notice,
  embedded = false,
}: {
  next: string;
  notice?: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | undefined>(notice);
  const [busy, setBusy] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const emailValid = isValidEmail(email);
  const codeValid = code.length === 6;

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    if (!emailValid) return;
    setBusy(true);
    setMessage(undefined);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    setBusy(false);
    if (error) {
      setMessage(
        error.status === 429
          ? "Too many requests. Please wait a few minutes and try again."
          : "We couldn't send a code. Check the address and try again."
      );
      return;
    }
    setStep("code");
    setMessage(
      "A 6-digit code is on its way. It expires in 5 minutes."
    );
    // Focus OTP input upon step change
    setTimeout(() => {
      otpInputRef.current?.focus();
    }, 50);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!codeValid) return;
    setBusy(true);
    setMessage(undefined);
    const { error } = await authClient.signIn.emailOtp({
      email: email.trim(),
      otp: code.trim(),
    });
    if (error) {
      setBusy(false);
      setMessage(
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : "That code isn't valid. Check it or request a new one."
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function continueWithGoogle() {
    setBusy(true);
    setMessage(undefined);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: "/sign-in",
      newUserCallbackURL: next,
    });
    if (error) {
      setBusy(false);
      setMessage(
        "We could not start Google sign-in. Please try again or use an email code."
      );
    }
  }

  return (
    <div className="flex w-full flex-col">
      {/* Centered intro block */}
      {!embedded ? (
        <div className="flex flex-col items-center text-center gap-2.5 sm:gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem] text-center">
            {step === "email" ? "Continue to Neffi" : "Check your email"}
          </h1>
          <p className="text-[0.8125rem] sm:text-[0.84rem] text-fg-secondary leading-normal text-center tracking-[-0.005em]">
            {step === "email" ? (
              "Sign in or create your account to manage your profiles and cards."
            ) : (
              <>
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Compact feedback notice */}
      {message ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-border/70 bg-subtle/50 px-3.5 py-2.5 text-meta text-foreground"
        >
          <AlertCircle
            aria-hidden
            className="size-4 shrink-0 text-fg-secondary mt-0.5"
          />
          <span>{message}</span>
        </div>
      ) : null}

      {step === "email" ? (
        <div className="mt-7 flex flex-col sm:mt-8">
          {/* Google Sign-in action */}
          <Button
            type="button"
            variant="outline"
            size="touch"
            className="h-[50px] w-full rounded-[10px] border border-border bg-background text-body font-medium text-foreground hover:bg-subtle/60 active:scale-[0.99] transition-all duration-150 gap-3"
            disabled={busy}
            onClick={continueWithGoogle}
          >
            <GoogleLogo className="size-5 shrink-0" />
            <span>Continue with Google</span>
          </Button>

          {/* Minimal divider (24px above & below) */}
          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border/80" />
            <span className="text-xs text-fg-secondary select-none">or</span>
            <span className="h-px flex-1 bg-border/80" />
          </div>

          {/* Email form (24px below divider) */}
          <form onSubmit={requestCode} className="mt-6 flex flex-col">
            <div className="flex flex-col text-left">
              <label
                htmlFor="email"
                className="text-body font-medium text-foreground"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="name@example.com"
                className={cn(
                  "mt-2 h-[50px] w-full rounded-[10px] border border-border bg-background px-4 text-body text-foreground transition-all duration-150 outline-none",
                  "placeholder:text-fg-secondary/40",
                  "focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
                )}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="mt-2 text-meta text-fg-secondary">
                We&apos;ll email you a 6-digit code. No password needed.
              </p>
            </div>

            <Button
              type="submit"
              size="touch"
              variant={emailValid && !busy ? "action" : "outline"}
              className={cn(
                "mt-4 h-[50px] w-full rounded-[10px] text-base font-semibold transition-all duration-[220ms]",
                (!emailValid || busy) &&
                  "bg-subtle text-fg-secondary/60 border border-border/80 cursor-not-allowed hover:bg-subtle hover:text-fg-secondary/60",
                emailValid && !busy && "gap-2 shadow-xs"
              )}
              disabled={!emailValid || busy}
            >
              {busy ? (
                <>
                  <LoaderCircle
                    aria-hidden
                    className="size-4.5 animate-spin motion-reduce:animate-none"
                  />
                  Sending code…
                </>
              ) : (
                <>
                  Continue with email
                  <ArrowRight aria-hidden className="size-4.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      ) : (
        /* OTP Step */
        <form onSubmit={verifyCode} className="mt-6 flex flex-col sm:mt-7">
          <div className="flex flex-col text-left">
            <label
              htmlFor="code"
              className="text-body font-medium text-foreground"
            >
              Verification code
            </label>
            <div className="mt-2">
              <OtpSlots
                value={code}
                onChange={setCode}
                disabled={busy}
                inputRef={otpInputRef}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <Button
              type="submit"
              size="touch"
              variant={codeValid && !busy ? "action" : "outline"}
              className={cn(
                "h-[50px] w-full rounded-[10px] text-base font-semibold transition-all duration-[220ms]",
                (!codeValid || busy) &&
                  "bg-subtle text-fg-secondary/60 border border-border/80 cursor-not-allowed hover:bg-subtle hover:text-fg-secondary/60",
                codeValid && !busy && "gap-2 shadow-xs"
              )}
              disabled={!codeValid || busy}
            >
              {busy ? (
                <>
                  <LoaderCircle
                    aria-hidden
                    className="size-4.5 animate-spin motion-reduce:animate-none"
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight aria-hidden className="size-4.5" />
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="touch"
              className="h-11 w-full rounded-[10px] text-body font-medium"
              disabled={busy}
              onClick={() => void requestCode()}
            >
              Send a new code
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="touch"
              className="h-11 w-full rounded-[10px] text-meta font-medium text-fg-secondary hover:text-foreground"
              disabled={busy}
              onClick={() => {
                setStep("email");
                setCode("");
                setMessage(undefined);
              }}
            >
              Use a different email
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
