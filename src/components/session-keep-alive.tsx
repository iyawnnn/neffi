"use client";

import { useEffect } from "react";
import { refreshSession } from "@/auth/actions";

// Keeps a signed-in person signed in: once per page load, ask the server to roll the session if it is due.
export function SessionKeepAlive() {
  useEffect(() => {
    void refreshSession();
  }, []);
  return null;
}
