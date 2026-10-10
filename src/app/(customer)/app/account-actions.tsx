"use client";

import { useState } from "react";
import { signOutAction } from "@/auth/actions";
import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";

export function AccountActions({ googleLinked }: { googleLinked: boolean }) {
  const [busy, setBusy] = useState(false);

  async function connectGoogle() {
    setBusy(true);
    // Better Auth links only when Google's verified email equals this Account's email.
    const { error } = await authClient.linkSocial({ provider: "google", callbackURL: "/app", errorCallbackURL: "/app" });
    if (error) setBusy(false);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {googleLinked ? null : (
        <Button type="button" variant="outline" size="lg" className="h-11 w-full" disabled={busy} onClick={connectGoogle}>
          Connect Google
        </Button>
      )}
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="lg" className="h-11 w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
