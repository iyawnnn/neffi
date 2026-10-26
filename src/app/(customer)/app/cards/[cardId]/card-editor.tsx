"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  HelpCircle,
  IdCard,
  LoaderCircle,
  Nfc,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ButtonLink, PositiveStatus } from "@/components/app-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CardSummary } from "@/modules/cards/manage";
import { saveCardSettingsAction } from "../actions";

type ProfileOption = {
  id: string;
  fullName: string | null;
  status: "draft" | "published" | "unpublished";
  unread?: number;
};

export function CardEditor({
  card,
  profiles,
  url,
  qr,
}: {
  card: CardSummary;
  profiles: ProfileOption[];
  url: string;
  qr: string | null;
}) {
  return (
    <Toast.Provider limit={1}>
      <CardEditorInner card={card} profiles={profiles} url={url} qr={qr} />
      <CardToasts />
    </Toast.Provider>
  );
}

function CardToasts() {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className="app-type fixed top-[calc(env(safe-area-inset-top)_+_5.5rem)] right-4 z-[60] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="flex items-center justify-between gap-3 rounded-panel border bg-background p-4 text-foreground shadow-md transition-opacity interact duration-[220ms] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none"
          >
            <div>
              <Toast.Title className="text-body font-medium" />
              <Toast.Description className="mt-1 text-meta text-fg-secondary" />
            </div>
            <Toast.Close
              aria-label="Dismiss notification"
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
            >
              <X aria-hidden className="size-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function CardEditorInner({
  card,
  profiles,
  url,
  qr,
}: {
  card: CardSummary;
  profiles: ProfileOption[];
  url: string;
  qr: string | null;
}) {
  const toast = Toast.useToastManager();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    card.profileId
  );
  const [disabled, setDisabled] = useState<boolean>(card.disabled);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(
    card.profileId
  );
  const [savedDisabled, setSavedDisabled] = useState<boolean>(card.disabled);
  const [showTurnOffDialog, setShowTurnOffDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDirty =
    selectedProfileId !== savedProfileId || disabled !== savedDisabled;

  const selectedProfile =
    profiles.find((p) => p.id === selectedProfileId) ??
    (card.profileId
      ? {
          id: card.profileId,
          fullName: card.profileName ?? "Untitled profile",
          status: "published" as const,
        }
      : profiles[0]);


  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.add({ title: "Link copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.add({ title: "Couldn’t copy link", priority: "high" });
    }
  }

  function handleToggleStatus() {
    if (!disabled) {
      setShowTurnOffDialog(true);
    } else {
      setDisabled(false);
    }
  }

  async function handleSave(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!isDirty || saving) return;
    setSaving(true);

    try {
      const data = new FormData();
      data.set("cardId", card.id);
      data.set("profileId", selectedProfileId ?? "");
      data.set("disabled", String(disabled));
      if (disabled) data.set("confirm", "on");
      const result = await saveCardSettingsAction(data);
      if ("error" in result) {
        toast.add({ title: "Couldn’t update card", description: result.error, priority: "high" });
        return;
      }

      setSavedProfileId(selectedProfileId);
      setSavedDisabled(disabled);
      toast.add({ title: "Card updated" });
    } catch {
      toast.add({
        title: "Couldn’t update card",
        description: "Your changes are still here. Try again.",
        priority: "high",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      data-canvas
      className="mx-auto flex w-full max-w-[944px] flex-1 flex-col gap-6 px-4 pt-6 pb-12 md:gap-8 md:px-6 md:pt-8 md:pb-16"
    >
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/app/cards"
          className="-ml-2 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-md px-2 text-meta font-medium text-fg-secondary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Back to cards
        </Link>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="min-w-0 max-w-full break-words text-title">
              Neffi •••• {card.suffix}
            </h1>
            <p className="mt-1.5 text-body text-fg-secondary">
              Manage which profile this card opens.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {card.profileId && card.previewSceneId ? <ButtonLink href={`/app/profiles/${card.profileId}/preview?scene=${card.previewSceneId}`} variant="outline">Preview</ButtonLink> : null}
            {card.profileId ? <ButtonLink href={`/app/profiles/${card.profileId}`} variant="action">Edit profile</ButtonLink> : null}
            <Link
              href={`/support?cardId=${card.id}`}
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-[10px] border border-border bg-background px-3.5 text-body font-medium text-foreground transition-colors duration-[220ms] hover:border-border-strong hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
            >
              <HelpCircle aria-hidden className="size-4 text-fg-secondary" />
              Get help
            </Link>
          </div>
        </header>
      </div>

      {/* Surface 1: Card settings */}
      <section
        aria-labelledby="card-settings-heading"
        className="flex flex-col gap-6 rounded-panel border bg-background p-5 sm:p-6 md:p-8"
      >
        <div className="flex flex-col gap-1 border-b border-border/60 pb-5">
          <h2 id="card-settings-heading" className="text-section font-semibold">
            Card settings
          </h2>
          <p className="text-body text-fg-secondary">
            Choose what people see when they tap this Neffi and control its
            status.
          </p>
        </div>

        {card.profileId ? (
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            <input type="hidden" name="cardId" value={card.id} />
            <input
              type="hidden"
              name="profileId"
              value={selectedProfileId ?? ""}
            />
            <input type="hidden" name="disabled" value={String(disabled)} />
            {disabled ? (
              <input type="hidden" name="confirm" value="on" />
            ) : null}

            {/* A. Connected profile */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <label
                  id="connected-profile-label"
                  className="text-body font-medium text-foreground"
                >
                  Connected profile
                </label>
                <p className="text-meta text-fg-secondary">
                  Select the profile that opens when this card is tapped or
                  scanned.
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-labelledby="connected-profile-label"
                      className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-[10px] border border-border bg-background px-3.5 py-2 text-body text-foreground transition-colors duration-[220ms] hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    />
                  }
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IdCard
                      aria-hidden
                      className="size-4 shrink-0 text-fg-secondary"
                    />
                    <span className="truncate font-medium">
                      {selectedProfile?.fullName ?? "Untitled profile"}
                    </span>
                    {selectedProfile?.status === "published" ? (
                      <PositiveStatus>Published</PositiveStatus>
                    ) : null}
                  </div>
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 text-fg-secondary"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-(--anchor-width) min-w-[280px] p-1.5"
                >
                  {profiles.map((p) => {
                    const isSelected = p.id === selectedProfileId;
                    return (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => setSelectedProfileId(p.id)}
                        className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-body"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <IdCard
                            aria-hidden
                            className="size-4 shrink-0 text-fg-secondary"
                          />
                          <span className="truncate font-medium">
                            {p.fullName ?? "Untitled profile"}
                          </span>
                          {p.status === "published" ? (
                            <PositiveStatus>Published</PositiveStatus>
                          ) : null}
                        </div>
                        {isSelected ? (
                          <Check
                            aria-hidden
                            className="size-4 shrink-0 text-brand"
                          />
                        ) : null}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* B. Card status */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-body font-medium text-foreground">
                  Card status
                </span>
                <p className="text-meta text-fg-secondary">
                  Control whether tapping this card opens your profile.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-canvas/40 p-4">
                <div className="flex min-w-0 items-start gap-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
                    <Nfc aria-hidden className="size-4 text-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-body font-medium text-foreground">
                      {!disabled ? "Active" : "Turned off"}
                    </span>
                    <p className="text-meta text-fg-secondary">
                      {!disabled
                        ? "When active, tapping or scanning this Neffi opens the connected profile."
                        : "This card won’t open a profile until you turn it back on."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={!disabled}
                  aria-label="Card status"
                  onClick={handleToggleStatus}
                  className="group/switch flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-[220ms] motion-reduce:transition-none",
                      !disabled ? "bg-action" : "bg-border-strong"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-[220ms] motion-reduce:transition-none",
                        !disabled ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </span>
                </button>
              </div>
            </div>

            {/* C. Save changes */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                size="touch"
                disabled={!isDirty || saving}
                variant={isDirty || saving ? "action" : "outline"}
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      aria-hidden
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-body text-fg-secondary">
              This Neffi is on your account but isn&apos;t showing a profile yet.
            </p>
            <ButtonLink
              href={`/app/setup/${card.id}`}
              variant="action"
              className="w-full sm:w-fit"
            >
              Set up this Neffi
            </ButtonLink>
          </div>
        )}
      </section>

      {/* Surface 2: Share your Neffi */}
      {qr ? (
        <section
          aria-labelledby="share-neffi-heading"
          className="flex flex-col gap-6 rounded-panel border bg-background p-5 sm:p-6 md:p-8"
        >
          <div className="flex flex-col gap-1 border-b border-border/60 pb-5">
            <h2 id="share-neffi-heading" className="text-section font-semibold">
              Share your Neffi
            </h2>
            <p className="text-body text-fg-secondary">
              Anyone who scans this QR opens the same page as tapping your card.
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
            {/* QR containment frame */}
            <div className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-background p-3.5 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="QR code for your Neffi link"
                width={180}
                height={180}
                className="size-44 sm:size-48"
              />
            </div>

            {/* Profile link + actions */}
            <div className="flex min-w-0 flex-1 flex-col gap-4 w-full">
              <div className="flex flex-col gap-1.5">
                <span className="text-body font-medium text-foreground">
                  Profile link
                </span>
                <p className="text-meta text-fg-secondary">
                  Share this link or QR code with others.
                </p>
              </div>

              {/* Actions row */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  size="touch"
                  variant="outline"
                  onClick={handleCopy}
                  className="w-full sm:w-auto gap-2"
                >
                  {copied ? (
                    <Check aria-hidden className="size-4" />
                  ) : (
                    <Copy aria-hidden className="size-4" />
                  )}
                  {copied ? "Link copied" : "Copy link"}
                </Button>
                <a
                  href={qr}
                  download="neffi-qr.svg"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "touch" }),
                    "w-full sm:w-auto gap-2"
                  )}
                >
                  <Download aria-hidden className="size-4" />
                  Download QR code
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Turn off card confirmation dialog */}
      <Dialog.Root open={showTurnOffDialog} onOpenChange={setShowTurnOffDialog}>
        <Dialog.Portal keepMounted>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-xs" />
          <Dialog.Popup className="app-type fixed top-1/2 left-1/2 z-50 w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-panel border bg-background p-5 text-foreground shadow-lg">
            <Dialog.Title className="text-section font-semibold">
              Turn off this Neffi?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-body text-fg-secondary">
              Tapping or scanning this card will no longer open your profile.
            </Dialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <Dialog.Close
                render={
                  <Button type="button" size="touch" variant="outline" />
                }
              >
                Cancel
              </Dialog.Close>
              <Button
                type="button"
                size="touch"
                variant="destructive"
                onClick={() => {
                  setDisabled(true);
                  setShowTurnOffDialog(false);
                }}
              >
                Turn off card
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
