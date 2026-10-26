"use client";

import { useState } from "react";
import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";

export function AccountActions({ googleLinked }: { googleLinked: boolean }) {
  const [busy, setBusy] = useState(false);

  async function connectGoogle() {
    setBusy(true);
    // Better Auth links only when Google's verified email equals this Account's email.
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: "/app/account",
      errorCallbackURL: "/app/account",
    });
    if (error) setBusy(false);
  }

  if (googleLinked) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="touch"
      className="h-11 w-full border-border bg-background px-4 font-medium text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-canvas active:bg-subtle sm:w-auto"
      loading={busy}
      loadingText="Connecting…"
      onClick={connectGoogle}
    >
      Connect Google
    </Button>
  );
}
