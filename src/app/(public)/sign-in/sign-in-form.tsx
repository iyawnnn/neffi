"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";

type Step = "email" | "code";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function SignInForm({ next, notice }: { next: string; notice?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | undefined>(notice);
  const [busy, setBusy] = useState(false);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setMessage(undefined);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setBusy(false);
    if (error) {
      setMessage(error.status === 429 ? "Too many requests. Please wait a few minutes and try again." : "We could not send a code. Check the address and try again.");
      return;
    }
    setStep("code");
    setMessage("If that address can receive email, a 6-digit code is on its way. It expires in 5 minutes.");
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
    if (error) {
      setBusy(false);
      setMessage(error.status === 429 ? "Too many attempts. Please wait a minute and try again." : "That code is not valid. Check it, or request a new one.");
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
      setMessage("We could not start Google sign-in. Please try again or use an email code.");
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {message ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      <Button type="button" variant="outline" size="lg" className="h-11 w-full" disabled={busy} onClick={continueWithGoogle}>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      {step === "email" ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="code">
            6-digit code sent to {email}
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className={`${inputClass} tracking-widest`}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
            Sign in
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void requestCode()}>
            Send a new code
          </Button>
          <Button type="button" variant="link" disabled={busy} onClick={() => setStep("email")}>
            Use a different email
          </Button>
        </form>
      )}
    </div>
  );
}
