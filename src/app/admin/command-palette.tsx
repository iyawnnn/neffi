"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Loader2, LifeBuoy, Package, Plus, Receipt, Search, SearchX } from "lucide-react";
import { Command, CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/modules/search-types";
import { navSections } from "./nav-sections";
import { describeHit, HitIcon, hitGroups, hitHref, hitKey } from "./search/hits";


const OPEN_EVENT = "admin:command-menu";

const quickActions = [
  { title: "New order", href: "/admin/orders/new", icon: ClipboardList },
  { title: "Receive stock", href: "/admin/inventory", icon: Package },
  { title: "Add expense", href: "/admin/expenses?add=1", icon: Receipt },
  { title: "Open support case", href: "/admin/support/new", icon: LifeBuoy },
];

const itemClass = "min-h-11 gap-3 px-3 text-body md:min-h-10";

/** One palette per shell. Triggers dispatch an event, so the sidebar field and the phone icon share it. */
type SearchResult = { loading: boolean; hits: SearchHit[]; failed: boolean; done: boolean };

export function CommandPalette({ useSearch, basePath = "/admin", recordHref = hitHref, mutationsEnabled = true }: {
  useSearch: (term: string) => SearchResult;
  basePath?: string; recordHref?: (hit: SearchHit) => string; mutationsEnabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const term = query.trim().slice(0, 100);

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        typeof event.key === "string" &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href.replace(/^\/admin(?=\/|\?|$)/, basePath));
  }, [router, basePath]);

  const { loading, hits, failed, done } = useSearch(term);
  const searching = term.length >= 2;
  // cmdk's own filter would hide whole groups of remote results, so commands are matched here instead.
  const matches = (text: string) => !term || text.toLowerCase().includes(term.toLowerCase());
  const actions = quickActions.filter(({ title }) => matches(title));
  const sections = navSections.filter(({ title }) => matches(`go to ${title}`));

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}
      title="Search and commands"
      description="Search orders, customers, cards and support cases, or jump to a section."
      className="top-[10%] sm:max-w-xl"
    >
      <Command loop shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder="Search records or type a command…" maxLength={100} />
        <CommandList className="max-h-[min(28rem,70dvh)] p-1.5">
          {searching ? (
            <>
              {hits.length ? hitGroups.map((group) => {
                const inGroup = hits.filter((hit) => (group.types as string[]).includes(hit.type));
                return inGroup.length ? (
                  <CommandGroup key={group.key} heading={group.heading}>
                    {inGroup.map((hit) => <HitItem key={hitKey(hit)} hit={hit} href={recordHref(hit)} onSelect={go} />)}
                  </CommandGroup>
                ) : null;
              }) : null}
              <div role="status" aria-live="polite">
                {loading ? <p className="flex items-center gap-2 px-3 py-3 text-meta text-fg-secondary"><Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />Searching records…</p> : null}
                {done && !hits.length && !failed ? <p className="flex items-center gap-2 px-3 py-3 text-meta text-fg-secondary"><SearchX aria-hidden className="size-3.5" />No records match “{term}”.</p> : null}
                {failed ? <p className="px-3 py-3 text-meta text-destructive">Search is unavailable right now. Try again in a moment.</p> : null}
              </div>
              <CommandGroup heading="Search">
                <CommandItem value={`all records ${term}`} onSelect={() => go(`/admin/search?${new URLSearchParams({ q: term })}`)} className={itemClass}>
                  <Search aria-hidden className="text-fg-secondary" />
                  <span className="min-w-0 flex-1 truncate">Search all records for “{term}”</span>
                  <ArrowRight aria-hidden className="text-fg-faint" />
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          ) : null}
          {actions.length ? <CommandGroup heading="Quick actions">
            {actions.map(({ title, href, icon: Icon }) => (
              <CommandItem key={title} disabled={!mutationsEnabled} value={`quick ${title}`} onSelect={() => go(href)} className={itemClass}>
                <span className="relative text-fg-secondary"><Icon aria-hidden className="size-4" /><Plus aria-hidden className="absolute -top-1 -right-1.5 size-2.5 text-action" strokeWidth={3} /></span>
                {title}
              </CommandItem>
            ))}
          </CommandGroup> : null}
          {sections.length ? <CommandGroup heading="Go to">
            {sections.map(({ key, title, href, icon: Icon }) => (
              <CommandItem key={key} value={`go to ${title}`} onSelect={() => go(href)} className={itemClass}>
                <Icon aria-hidden className="text-fg-secondary" />
                Go to {title}
              </CommandItem>
            ))}
          </CommandGroup> : null}
          {!searching && !actions.length && !sections.length ? <p className="px-3 py-3 text-meta text-fg-secondary">No matching command.</p> : null}
        </CommandList>
        <p className="hidden items-center justify-between gap-4 border-t px-4 py-2 text-label text-fg-secondary md:flex">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> to move</span>
          <span><Kbd>Enter</Kbd> to open · <Kbd>Esc</Kbd> to close</span>
        </p>
      </Command>
    </CommandDialog>
  );
}

function HitItem({ hit, href, onSelect }: { hit: SearchHit; href: string; onSelect: (href: string) => void }) {
  const { title, subtitle, status } = describeHit(hit);
  return (
    <CommandItem value={hitKey(hit)} onSelect={() => onSelect(href)} className={cn(itemClass, "items-start py-2")}>
      <HitIcon type={hit.type} className="mt-0.5 text-fg-secondary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground">{title}</span>
        <span className="truncate text-meta text-fg-secondary">{subtitle}{status ? ` · ${status}` : ""}</span>
      </span>
      <span className="mt-0.5 hidden shrink-0 text-label text-fg-faint sm:block">{hit.matched}</span>
    </CommandItem>
  );
}

function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("rounded border bg-canvas px-1.5 py-px font-sans text-label font-medium text-fg-secondary nav-interact transition-colors", className)}>{children}</kbd>;
}

const subscribeNever = () => () => {};
const openMenu = () => window.dispatchEvent(new Event(OPEN_EVENT));

/** Sidebar field that looks like a search box and opens the palette. */
export function CommandMenuField() {
  // Server and first client render agree on "Ctrl"; Apple devices switch to the Command symbol afterwards.
  const mac = useSyncExternalStore(subscribeNever, () => /mac|iphone|ipad/i.test(navigator.platform), () => false);
  return (
    <button type="button" onClick={openMenu} className="group flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-body text-fg-faint nav-interact transition-colors hover:border-border-strong hover:bg-canvas hover:text-foreground active:bg-subtle focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 focus-visible:outline-none">
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="flex-1 text-left">Search</span>
      <span aria-hidden className="flex items-center gap-1"><Kbd className="group-hover:border-border-strong group-hover:text-foreground">{mac ? "⌘" : "Ctrl"}</Kbd><Kbd className="group-hover:border-border-strong group-hover:text-foreground">K</Kbd></span>
      <span className="sr-only">Open search and commands ({mac ? "Command" : "Control"} K)</span>
    </button>
  );
}

/** Icon-only trigger for the phone header. */
export function CommandMenuIconButton() {
  return (
    <button type="button" onClick={openMenu} aria-label="Search" className="inline-flex size-11 items-center justify-center rounded-lg text-fg-secondary nav-interact transition-colors hover:bg-subtle hover:text-foreground active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand">
      <Search aria-hidden className="size-5" />
    </button>
  );
}
