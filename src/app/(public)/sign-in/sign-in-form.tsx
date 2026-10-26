"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { authClient } from "@/auth/client";
import { CodeSlots } from "@/components/code-slots";
import { GoogleLogo } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Step = "email" | "code";
type Pending = "google" | "email" | "verify" | "resend";

export { inputClass };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
  const [feedback, setFeedback] = useState<
    { text: string; type: "info" | "error" } | undefined
  >(notice ? { text: notice, type: "error" } : undefined);
  const [pending, setPending] = useState<Pending | null>(null);
  const busy = pending !== null;
  const otpInputRef = useRef<HTMLInputElement>(null);

  const emailValid = isValidEmail(email);
  const codeValid = code.length === 6;

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    if (!emailValid) return;
    setPending(step === "code" ? "resend" : "email");
    setFeedback(undefined);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    setPending(null);
    if (error) {
      setFeedback({
        text:
          error.status === 429
            ? "Too many requests. Please wait a few minutes and try again."
            : "We couldn't send a code. Check the address and try again.",
        type: "error",
      });
      return;
    }
    setStep("code");
    setFeedback({
      text: "A 6-digit code is on its way. It expires in 5 minutes.",
      type: "info",
    });
    // Focus OTP input upon step change
    setTimeout(() => {
      otpInputRef.current?.focus();
    }, 50);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!codeValid) return;
    setPending("verify");
    setFeedback(undefined);
    const { error } = await authClient.signIn.emailOtp({
      email: email.trim(),
      otp: code.trim(),
    });
    if (error) {
      setPending(null);
      setFeedback({
        text:
          error.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : "That code isn't valid. Check it or request a new one.",
        type: "error",
      });
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function continueWithGoogle() {
    setPending("google");
    setFeedback(undefined);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: "/sign-in",
      newUserCallbackURL: next,
    });
    if (error) {
      setPending(null);
      setFeedback({
        text: "We could not start Google sign-in. Please try again or use an email code.",
        type: "error",
      });
    }
  }

  return (
    <div data-sign-in-form data-embedded={embedded} className="flex w-full flex-col">
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
      {feedback ? (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          id={feedback.type === "error" && step === "code" ? "code-error" : undefined}
          className={cn(
            "mt-4 flex items-start gap-2.5 rounded-[10px] px-3.5 py-2.5 text-meta",
            feedback.type === "error"
              ? "border border-destructive/35 bg-destructive/5 text-destructive"
              : "border border-border/70 bg-subtle/50 text-foreground"
          )}
        >
          <AlertCircle
            aria-hidden
            className={cn(
              "size-4 shrink-0 mt-0.5",
              feedback.type === "error" ? "text-destructive" : "text-fg-secondary"
            )}
          />
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {step === "email" ? (
        <div data-sign-in-options className="mt-7 flex flex-col sm:mt-8">
          {/* Google Sign-in action */}
          <Button
            type="button"
            variant="outline"
            size="touch"
            className="h-[50px] w-full gap-3 rounded-[10px] text-body font-medium text-foreground"
            disabled={busy}
            loading={pending === "google"}
            loadingText="Opening Google…"
            onClick={continueWithGoogle}
          >
            <GoogleLogo className="size-5 shrink-0" />
            Continue with Google
          </Button>

          {/* Minimal divider (24px above & below) */}
          <div data-auth-divider className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border/80" />
            <span className="text-xs text-fg-secondary select-none">or</span>
            <span className="h-px flex-1 bg-border/80" />
          </div>

          {/* Email form (24px below divider) */}
          <form data-email-entry onSubmit={requestCode} className="mt-6 flex flex-col">
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
              variant={emailValid || pending === "email" ? "action" : "outline"}
              className={cn("mt-4 h-[50px] w-full gap-2 rounded-[10px] text-base font-semibold", !emailValid && pending !== "email" && "bg-subtle text-fg-secondary border-border-strong/70 hover:bg-subtle hover:text-fg-secondary disabled:opacity-100 disabled:shadow-none")}
              disabled={!emailValid || busy}
              loading={pending === "email"}
              loadingText="Sending code…"
            >
              Continue with email
              <ArrowRight aria-hidden className="size-4.5" />
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
              <CodeSlots
                label="6-digit verification code"
                describedBy={feedback?.type === "error" ? "code-error" : undefined}
                value={code}
                onChange={setCode}
                disabled={busy}
                hasError={step === "code" && feedback?.type === "error"}
                inputRef={otpInputRef}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <Button
              type="submit"
              size="touch"
              variant={codeValid || pending === "verify" ? "action" : "outline"}
              className={cn("h-[50px] w-full gap-2 rounded-[10px] text-base font-semibold", !codeValid && pending !== "verify" && "bg-subtle text-fg-secondary border-border-strong/70 hover:bg-subtle hover:text-fg-secondary disabled:opacity-100 disabled:shadow-none")}
              disabled={!codeValid || busy}
              loading={pending === "verify"}
              loadingText="Signing in…"
            >
              Sign in
              <ArrowRight aria-hidden className="size-4.5" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="touch"
              className="h-11 w-full rounded-[10px] text-body font-medium"
              disabled={busy}
              loading={pending === "resend"}
              loadingText="Sending…"
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
                setFeedback(undefined);
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
