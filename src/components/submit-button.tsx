"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// A submit button that reflects its parent <form action> while the server action runs.
export function SubmitButton({ pendingText, ...props }: Omit<ComponentProps<typeof Button>, "type" | "loading" | "loadingText"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} loadingText={pendingText} {...props} />;
}
