"use client";

import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, Layers, Pencil, Plus, SlidersHorizontal, Trash2, type LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useActionState, useState } from "react";
import { ButtonLink } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OwnedProfile } from "@/modules/profiles/profiles";
import { createSceneAction, deleteProfileAction, showSceneAction } from "./actions";

export function EditorDialog({
  trigger,
  title,
  description,
  children,
  icon: Icon,
  iconClassName,
  className,
  centered = false,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
  centered?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity interact duration-[220ms] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          className={cn(
            "app-type fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border bg-background p-6 text-foreground shadow-lg transition-opacity interact duration-[220ms] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none",
            className,
          )}
        >
          {Icon ? (
            <div
              className={cn(
                "mb-4 inline-flex size-12 items-center justify-center rounded-full",
                centered && "mx-auto flex",
                iconClassName ?? "border border-border bg-canvas text-foreground",
              )}
            >
              <Icon className="size-6" strokeWidth={1.75} />
            </div>
          ) : null}
          <Dialog.Title className={cn("text-lg leading-6 font-semibold", centered && "text-center")}>
            {title}
          </Dialog.Title>
          <Dialog.Description
            className={cn(
              "mt-2 mb-6 text-body text-fg-secondary whitespace-pre-line",
              centered && "mx-auto max-w-sm text-center",
            )}
          >
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DialogCancel() {
  return (
    <Dialog.Close
      render={
        <Button
          size="touch"
          variant="outline"
          className="min-h-11 rounded-[10px] interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-[42px]"
        />
      }
    >
      Cancel
    </Dialog.Close>
  );
}

export function AddModeForm({
  profileId,
  scenes,
  currentSceneName,
  cancel,
}: {
  profileId: string;
  scenes: OwnedProfile["scenes"];
  currentSceneName: string;
  cancel?: ReactNode;
}) {
  const [state, action, pending] = useActionState(createSceneAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="profileId" value={profileId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mode-name" className="text-sm font-medium text-foreground">
          Mode name
        </label>
        <Input
          id="mode-name"
          name="name"
          placeholder="e.g. Freelance, Portfolio, Event"
          required
          maxLength={40}
          autoFocus
          className="h-11 rounded-[10px]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Start with</span>
        <div className="grid gap-2.5">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 interact transition-colors hover:bg-canvas has-[:checked]:border-brand/40 has-[:checked]:bg-brand/[0.03]">
            <input
              type="radio"
              name="copyFrom"
              value="empty"
              defaultChecked
              className="mt-1 size-4 accent-brand cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-body font-semibold text-foreground">Start blank</span>
              <span className="text-meta text-fg-secondary">Build this mode from scratch.</span>
            </div>
          </label>

          {scenes.map((scene) => (
            <label
              key={scene.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 interact transition-colors hover:bg-canvas has-[:checked]:border-brand/40 has-[:checked]:bg-brand/[0.03]"
            >
              <input
                type="radio"
                name="copyFrom"
                value={scene.id}
                className="mt-1 size-4 accent-brand cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-body font-semibold text-foreground">Copy {scene.name}</span>
                <span className="text-meta text-fg-secondary">
                  {scene.name === currentSceneName
                    ? "Use your current mode as a starting point."
                    : `Use ${scene.name} as a starting point.`}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}

      <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
        {cancel}
        <Button
          type="submit"
          variant="default"
          size="touch"
          className="min-h-11 rounded-[10px] bg-primary text-primary-foreground font-medium interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none"
          disabled={pending}
        >
          Create mode
        </Button>
      </div>
    </form>
  );
}

export function ModeStatus({
  isShown,
  isActive,
  isDefault = false,
}: {
  isShown?: boolean;
  isActive?: boolean;
  isDefault?: boolean;
}) {
  const current = Boolean(isShown ?? isActive);
  if (!current && !isDefault) return null;
  return (
    <div className="flex items-center gap-1.5 text-meta text-fg-secondary">
      {current ? <span>Currently showing</span> : null}
      {current && isDefault ? <span>·</span> : null}
      {isDefault ? <span>Default</span> : null}
    </div>
  );
}

export function AddModeDialog({
  profileId,
  scenes,
  currentSceneName,
  trigger,
}: {
  profileId: string;
  scenes: OwnedProfile["scenes"];
  currentSceneName: string;
  trigger?: ReactElement;
}) {
  return (
    <EditorDialog
      trigger={
        <Dialog.Trigger
          render={
            trigger ?? (
              <Button
                size="touch"
                variant="outline"
                className="min-h-11 gap-1.5 rounded-[10px] px-3.5 text-body font-medium interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-[40px]"
              >
                <Plus aria-hidden className="size-4" />
                Add profile mode
              </Button>
            )
          }
        />
      }
      icon={Layers}
      title="Add a profile mode"
      description="Create another version of your profile for a different situation. Your name, contact details, and appearance stay the same."
      className="max-w-lg"
    >
      <AddModeForm
        profileId={profileId}
        scenes={scenes}
        currentSceneName={currentSceneName}
        cancel={<DialogCancel />}
      />
    </EditorDialog>
  );
}

// Backward-compatible alias
export const AddSceneDialog = AddModeDialog;

export function ManageModesDialog({
  profile,
  initialView = "manage",
}: {
  profile: OwnedProfile;
  initialView?: "manage" | "create";
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"manage" | "create">(initialView);

  const shown = profile.scenes.find((s) => s.isShown) ?? profile.scenes.find((s) => s.isDefault) ?? profile.scenes[0];
  const activeModeName = shown?.name ?? "Default mode";

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setView("manage");
    }
  };

  const isCreate = view === "create";

  return (
    <EditorDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Dialog.Trigger
          render={
            <Button
              size="touch"
              variant="outline"
              className="h-10 min-h-0 gap-1.5 rounded-[10px] border-border bg-background px-3.5 text-body font-medium shadow-none hover:border-border-strong hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-9"
            >
              <SlidersHorizontal aria-hidden className="size-3.5 text-fg-secondary" />
              <span className="sm:hidden">Manage</span><span className="hidden sm:inline">Manage modes</span>
            </Button>
          }
        />
      }
      icon={Layers}
      title={isCreate ? "Add a profile mode" : "Profile modes"}
      description={
        isCreate
          ? "Create another version of your profile for a different situation. Your name, contact details, and appearance stay the same."
          : "Another version of the same profile for a different situation."
      }
      className="max-w-lg"
    >
      {isCreate ? (
        <AddModeForm
          profileId={profile.id}
          scenes={profile.scenes}
          currentSceneName={activeModeName}
          cancel={
            <Button
              type="button"
              size="touch"
              variant="outline"
              onClick={() => setView("manage")}
              className="min-h-11 rounded-[10px] interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-[42px]"
            >
              Cancel
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="divide-y rounded-panel border bg-background">
            {profile.scenes.map((scene) => {
              const isActive = scene.id === shown?.id;
              return (
                <li
                  key={scene.id}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3.5 sm:p-4",
                    isActive ? "bg-brand/[0.02]" : "hover:bg-canvas/50",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body font-semibold text-foreground">
                      {scene.name}
                    </span>
                    <ModeStatus isShown={isActive} isDefault={scene.isDefault} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isActive ? (
                      <form action={showSceneAction}>
                        <input type="hidden" name="profileId" value={profile.id} />
                        <input type="hidden" name="sceneId" value={scene.id} />
                        <Button
                          type="submit"
                          size="touch"
                          variant="outline"
                          className="min-h-11 h-9 rounded-[8px] px-2.5 text-xs font-medium sm:h-[34px]"
                        >
                          Switch
                        </Button>
                      </form>
                    ) : null}
                    <ButtonLink
                      href={`/app/profiles/${profile.id}/scenes/${scene.id}`}
                      variant="outline"
                      className="min-h-11 h-9 rounded-[8px] px-2.5 text-xs font-medium sm:h-[34px]"
                    >
                      <Pencil aria-hidden className="size-3" />
                      Edit
                    </ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>

          <Button
            type="button"
            size="touch"
            variant="outline"
            onClick={() => setView("create")}
            className="min-h-11 w-full gap-2 rounded-[10px] border-dashed font-medium interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-11"
          >
            <Plus aria-hidden className="size-4" />
            Add profile mode
          </Button>
        </div>
      )}
    </EditorDialog>
  );
}

export function DeleteProfileDialog({
  profileId,
  name,
  cards = [],
  cardCount = cards.length,
}: {
  profileId: string;
  name: string;
  cards?: Array<{ id: string; suffix: string }>;
  cardCount?: number;
}) {
  const count = cards.length || cardCount;
  const isBlocked = count > 0;
  const isSingleCard = count === 1;
  const card = cards[0];
  const cardLabel = card?.suffix ? `Neffi •••• ${card.suffix.toUpperCase()}` : "Neffi card";

  const title = isBlocked
    ? isSingleCard
      ? "Move your card before deleting this profile"
      : "Move your cards before deleting this profile"
    : `Delete ${name}?`;

  const description = isBlocked
    ? isSingleCard
      ? `${name} is still connected to ${cardLabel}.\n\nChoose another profile for this card first. After that, you can return here and delete ${name}.`
      : `${count} cards are still connected to ${name}.\n\nConnect them to another profile first. After that, you can return here and delete ${name}.`
    : "This permanently deletes this profile and its content.\nThis action can’t be undone.";

  return (
    <EditorDialog
      trigger={
        <Dialog.Trigger
          render={
            <Button
              size="touch"
              variant="outline"
              className="min-h-11 gap-2 rounded-[10px] border-destructive/30 bg-destructive/5 text-destructive hover:border-destructive/40 hover:bg-destructive/10 active:bg-destructive/15 interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-[42px]"
            />
          }
        >
          <Trash2 aria-hidden className="size-4" />
          Delete profile
        </Dialog.Trigger>
      }
      icon={isBlocked ? AlertTriangle : Trash2}
      iconClassName={
        isBlocked
          ? "border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border border-destructive/20 bg-destructive/10 text-destructive"
      }
      title={title}
      description={description}
      centered={true}
      className="max-w-lg"
    >
      {isBlocked ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <DialogCancel />
          <ButtonLink
            href={isSingleCard && card?.id ? `/app/cards/${card.id}` : "/app/cards"}
            variant="action"
            className="min-h-11 rounded-[10px] sm:h-[42px]"
          >
            {isSingleCard ? "Manage card" : "Manage connected cards"}
          </ButtonLink>
        </div>
      ) : (
        <DeleteProfileForm profileId={profileId} cancel={<DialogCancel />} />
      )}
    </EditorDialog>
  );
}

function DeleteProfileForm({ profileId, cancel }: { profileId: string; cancel?: ReactNode }) {
  const [state, action, pending] = useActionState(deleteProfileAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="confirm" value="on" />
      {state?.error ? <p role="alert" className="text-center text-sm text-destructive">{state.error}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        {cancel}
        <Button
          type="submit"
          size="touch"
          variant="destructive"
          className="min-h-11 rounded-[10px] interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-[42px]"
          disabled={pending}
        >
          Delete profile
        </Button>
      </div>
    </form>
  );
}
