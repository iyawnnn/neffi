"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { categories } from "@/modules/support/categories";
import { submitSupportAction } from "./actions";

export function SupportForm({
  email,
  clientKey,
  topic,
  cardId,
}: {
  email?: string;
  clientKey: string;
  topic: keyof typeof categories;
  cardId?: string;
}) {
  const [state, action, pending] = useActionState(submitSupportAction, undefined);
  const [fields, setFields] = useState({
    email: email ?? "",
    name: "",
    category: topic,
    topic,
    message: "",
  });

  if (fields.topic !== topic) {
    setFields({ ...fields, topic, category: topic });
  }

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center py-10 px-4 text-center sm:py-12"
      >
        <div className="flex size-12 items-center justify-center rounded-full border border-border/80 bg-subtle/60 text-brand">
          <CheckCircle2 aria-hidden className="size-6 text-brand" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Request sent
        </h2>
        <p className="mt-2 max-w-sm text-body text-fg-secondary leading-relaxed">
          We’ve received your message and will reply to the contact email you provided.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href={email ? "/app" : "/sign-in"}
            className="group inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-border bg-background px-5 py-2.5 text-meta font-medium text-foreground transition-colors hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="nav-interact transition-colors group-hover:text-brand">
              {email ? "Back to app" : "Back to sign in"}
            </span>
            <ArrowRight
              aria-hidden
              className="size-3.5 shrink-0 nav-interact nav-arrow"
            />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-[1.375rem]">
          Contact support
        </h2>
        <p className="mt-1 text-meta text-fg-secondary leading-normal">
          We’ll reply to the email you provide below.
        </p>
      </div>

      <form action={action} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="clientKey" value={clientKey} />
        {cardId ? <input type="hidden" name="cardId" value={cardId} /> : null}
        <div hidden aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <label htmlFor="email" className="text-body font-medium text-foreground">
            Contact email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            required
            placeholder="you@example.com"
            value={fields.email}
            onChange={(event) =>
              setFields({ ...fields, email: event.target.value })
            }
            readOnly={Boolean(email)}
            autoComplete="email"
            className={cn(
              "h-11 w-full rounded-[10px] border border-border bg-background px-3.5 text-body text-foreground outline-none transition-all duration-150",
              "placeholder:text-fg-secondary/40",
              "focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20",
              Boolean(email) && "bg-subtle/50 text-fg-secondary cursor-not-allowed"
            )}
          />
          <p className="text-meta text-fg-secondary">
            Your contact email is unverified and does not confirm account ownership.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <label htmlFor="name" className="text-body font-medium text-foreground">
            Name (optional)
          </label>
          <Input
            id="name"
            name="name"
            maxLength={100}
            autoComplete="name"
            placeholder="Your name"
            value={fields.name}
            onChange={(event) =>
              setFields({ ...fields, name: event.target.value })
            }
            className="h-11 w-full rounded-[10px] border border-border bg-background px-3.5 text-body text-foreground outline-none transition-all duration-150 placeholder:text-fg-secondary/40 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <label htmlFor="category" className="text-body font-medium text-foreground">
            What do you need help with?
          </label>
          <div className="relative w-full">
            <select
              id="category"
              name="category"
              value={fields.category}
              onChange={(event) =>
                setFields({
                  ...fields,
                  category: event.target.value as keyof typeof categories,
                })
              }
              className="h-11 w-full appearance-none rounded-[10px] border border-border bg-background px-3.5 pr-10 text-body text-foreground outline-none transition-all duration-150 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 cursor-pointer"
            >
              {Object.entries(categories).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-fg-secondary">
              <ChevronDown aria-hidden className="size-4" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <label htmlFor="message" className="text-body font-medium text-foreground">
            Message
          </label>
          <Textarea
            id="message"
            name="message"
            maxLength={2000}
            required
            rows={5}
            placeholder="Tell us what’s happening..."
            value={fields.message}
            onChange={(event) =>
              setFields({ ...fields, message: event.target.value })
            }
            className="h-[130px] resize-none overflow-y-auto w-full rounded-[10px] border border-border bg-background p-3.5 text-body text-foreground outline-none transition-all duration-150 placeholder:text-fg-secondary/40 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
          />
        </div>

        {/* Security helper directly above the button */}
        <div className="flex items-center gap-2 pt-0.5 text-meta text-fg-secondary">
          <Shield aria-hidden className="size-4 shrink-0 text-fg-faint" />
          <span>Do not include sign-in codes, activation codes or other secrets.</span>
        </div>

        {state?.error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[10px] border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-meta text-destructive"
          >
            <AlertCircle aria-hidden className="size-4 shrink-0 mt-0.5 text-destructive" />
            <span>{state.error}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          size="touch"
          variant="action"
          disabled={pending}
          className={cn(
            "h-11 w-full rounded-[10px] text-body font-semibold !text-white bg-action hover:bg-action-hover active:translate-y-px transition-all duration-[220ms] shadow-xs [&_*]:!text-white",
            pending && "cursor-not-allowed opacity-80"
          )}
        >
          {pending ? (
            <>
              <LoaderCircle
                aria-hidden
                className="size-4 animate-spin motion-reduce:animate-none !text-white"
              />
              <span className="!text-white">Sending…</span>
            </>
          ) : (
            <span className="!text-white">Send request</span>
          )}
        </Button>
      </form>
    </div>
  );
}
