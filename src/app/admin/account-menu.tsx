"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import { signOutAction } from "@/auth/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** The account row at the foot of the sidebar and the phone menu: one quiet trigger, with Sign out one tap inside it. */
export function AccountMenu({ email }: { email: string }) {
  return (
    <div className="border-t pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-h-12 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left nav-interact transition-colors hover:bg-canvas aria-expanded:bg-subtle focus-visible:outline-2 focus-visible:outline-brand">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-meta font-medium text-foreground" title={email}>{email}</span>
            <span className="text-label text-fg-secondary">Owner</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-fg-faint" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-60 min-w-56 p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="truncate text-meta font-medium text-foreground">{email}</span>
              <span className="text-label font-normal text-fg-secondary">Owner</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { void signOutAction(); }} className="min-h-11 gap-2.5 px-2 text-meta font-medium md:min-h-9">
            <LogOut aria-hidden className="text-fg-secondary" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
