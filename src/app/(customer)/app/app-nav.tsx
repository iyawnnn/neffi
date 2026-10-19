"use client";

import { Bell, ChevronDown, CircleUser, House, LogOut, Nfc, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { signOutAction } from "@/auth/actions";
import { NeffiLogo } from "@/components/neffi-logo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Account is reached from the avatar menu, so it is not a section.
const sections = [
  { label: "Home", href: "/app", icon: House },
  { label: "Profiles", href: "/app/profiles", icon: UserRound },
  { label: "Cards", href: "/app/cards", icon: Nfc },
] as const;

const isCurrent = (pathname: string, href: string) => pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));

type HeaderAccount = { name: string | null; email: string };

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

const isScrolled = () => window.scrollY > 8;
const isScrolledOnServer = () => false;

// Logo left, sections centred on the viewport (a 1fr/auto/1fr grid, from md), Inbox and account right.
export function AppHeader({ account, unread }: { account: HeaderAccount; unread: number }) {
  const pathname = usePathname();
  const scrolled = useSyncExternalStore(subscribeToScroll, isScrolled, isScrolledOnServer);
  return (
    <header className="sticky top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 mx-auto mt-[calc(env(safe-area-inset-top)+0.75rem)] w-full max-w-6xl bg-inherit px-4 md:top-3 md:mt-3 md:px-6">
      <div data-scrolled={scrolled} className="app-shell grid h-[58px] w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 interact transition-[border-color,box-shadow] md:h-16 md:px-5">
        <Link href="/app" aria-label="Neffi home" className="inline-flex min-h-11 cursor-pointer items-center justify-self-start rounded-md interact transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          <NeffiLogo aria-hidden className="h-6 w-auto text-foreground" />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-0.5">
            {sections.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} className="group inline-flex min-h-11 cursor-pointer items-center focus-visible:outline-none">
                  {/* Active: a quiet raised tab (Snow surface, hairline inset ring, 1px shadow). No underline, no Vermilion. */}
                  <span className="inline-flex h-9 items-center rounded-[9px] px-3.5 text-nav text-fg-secondary interact transition-[color,background-color,box-shadow] group-hover:bg-canvas group-hover:text-foreground group-focus-visible:outline-2 group-focus-visible:outline-brand group-aria-[current=page]:bg-canvas group-aria-[current=page]:text-foreground group-aria-[current=page]:shadow-[inset_0_0_0_1px_var(--border),0_1px_2px_color-mix(in_oklab,var(--foreground)_6%,transparent)]">
                    {label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-start-3 flex min-w-0 max-w-full items-center gap-0.5 justify-self-end">
          <InboxLink unread={unread} current={isCurrent(pathname, "/app/inbox")} />
          <AccountMenu account={account} current={isCurrent(pathname, "/app/account")} />
        </div>
      </div>
    </header>
  );
}

// The Inbox holds the messages people send from a Neffi; the dot is its real unread count, never a guess.
function InboxLink({ unread, current }: { unread: number; current: boolean }) {
  const [count, setCount] = useState({ source: unread, value: unread });
  if (count.source !== unread) setCount({ source: unread, value: unread });
  useEffect(() => {
    const update = (event: Event) => setCount({ source: unread, value: (event as CustomEvent<number>).detail });
    window.addEventListener("neffi:inbox-unread", update);
    return () => window.removeEventListener("neffi:inbox-unread", update);
  }, [unread]);
  return (
    <Link href="/app/inbox" aria-current={current ? "page" : undefined} aria-label={count.value ? `Inbox, ${count.value} unread` : "Inbox"} className="group relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-secondary focus-visible:outline-none">
      <span aria-hidden className="absolute inset-[3px] rounded-full interact transition-[background-color,box-shadow] group-hover:bg-canvas group-hover:shadow-[inset_0_0_0_1px_var(--border)] group-active:bg-subtle group-focus-visible:outline-2 group-focus-visible:outline-brand group-aria-[current=page]:bg-subtle" />
      <Bell aria-hidden className="relative size-[1.125rem] interact transition-colors group-hover:text-foreground group-aria-[current=page]:text-foreground" strokeWidth={1.6} />
      {count.value ? <span aria-hidden className="absolute top-2.5 right-2.5 size-2 rounded-full bg-brand ring-2 ring-background" /> : null}
    </Link>
  );
}

function AccountMenu({ account, current }: { account: HeaderAccount; current: boolean }) {
  const display = account.name ?? account.email.split("@")[0];
  const firstName = display.split(/\s+/)[0];
  const avatar = (size: string) => (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-foreground font-medium text-background", size)}>{firstName[0]?.toUpperCase()}</span>
  );
  return (
    <>
      <form id="app-sign-out" action={signOutAction} hidden />
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Account menu for ${display}`} className={cn("group inline-flex h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-[12px] p-1.5 interact transition-[background-color,box-shadow] hover:bg-canvas hover:shadow-[inset_0_0_0_1px_var(--border)] active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand data-[popup-open]:bg-subtle data-[popup-open]:shadow-[inset_0_0_0_1px_var(--border-strong)] sm:pr-3.5", current && "bg-canvas")}>
          {avatar("size-8 text-[0.8125rem]")}
          <span className="hidden min-w-0 max-w-32 truncate text-nav text-foreground sm:inline">{firstName}</span>
          <ChevronDown aria-hidden className="-ml-0.5 hidden size-3.5 shrink-0 text-fg-secondary interact transition-transform group-data-[popup-open]:rotate-180 motion-reduce:transition-none sm:inline" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className={cn("app-type w-64 rounded-panel p-1.5 shadow-[0_16px_40px_-16px_color-mix(in_oklab,var(--foreground)_28%,transparent)] ring-border interact motion-reduce:animate-none")}>
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            {avatar("size-9 text-sm")}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-semibold">{display}</span>
              <span className="truncate text-meta text-fg-secondary">{account.email}</span>
            </span>
          </div>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem render={<Link href="/app/account" className="min-h-11" />} className="min-h-11 cursor-pointer gap-2.5 rounded-lg px-2.5 text-body interact transition-colors">
            <CircleUser aria-hidden className="size-4 text-fg-secondary" />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuItem nativeButton render={<button type="submit" form="app-sign-out" />} className="min-h-11 w-full cursor-pointer gap-2.5 rounded-lg px-2.5 text-body interact transition-colors">
            <LogOut aria-hidden className="size-4 text-fg-secondary" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// Floating tab bar below md: 12px off the edge plus the safe area, 66px tall. The current tab is marked by a
// Vermilion icon and a stronger label only; no inner pill.
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 md:hidden">
      <ul className="app-shell mx-auto grid max-w-md grid-cols-3 p-2">
        {sections.map(({ label, href, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href} className="flex">
              <Link href={href} aria-current={current ? "page" : undefined} className={cn("flex min-h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] text-label interact transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand", current ? "font-semibold text-foreground" : "text-fg-secondary active:text-foreground")}>
                <Icon aria-hidden className={cn("size-[1.375rem] interact transition-colors", current ? "text-brand" : "text-fg-secondary")} strokeWidth={current ? 2 : 1.6} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
