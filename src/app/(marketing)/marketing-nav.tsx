"use client";

import { ArrowUp, ArrowUpRight, Ellipsis, Nfc, Route, Tag, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Ordering runs through Messenger and has no page yet; point the Get Neffi action at its real destination here.
const GET_NEFFI_HREF = "/pricing";

type NavLink = { label: string; href: string; icon: LucideIcon };
type MoreLink = { label: string; href: string; description: string };

const leading: NavLink[] = [
  { label: "Product", href: "/product", icon: Nfc },
  { label: "Guide", href: "/guide", icon: Route },
];
const trailing: NavLink = { label: "Pricing", href: "/pricing", icon: Tag };

// Legal links live in the marketing footer, not here.
const moreLinks: MoreLink[] = [
  { label: "Home", href: "/", description: "Back to Neffi" },
  { label: "Help", href: "/help", description: "FAQs and guides" },
  { label: "Activate your card", href: "/activate", description: "Set up your Neffi card" },
  { label: "Sign in", href: "/sign-in", description: "Access your account" },
  { label: "Support", href: "/support", description: "Get help from Neffi" },
];

const isCurrent = (pathname: string, href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function MarketingNav() {
  const pathname = usePathname();
  // Home is not a dock slot, so being on it does not light up More.
  const moreCurrent = moreLinks.some(({ href }) => href !== "/" && isCurrent(pathname, href));
  return (
    <>
      <DesktopDock pathname={pathname} moreCurrent={moreCurrent} />
      <MobileBar pathname={pathname} moreCurrent={moreCurrent} />
    </>
  );
}

// ---------------------------------------------------------------- shared

// One light travelling the whole rim (top, right, bottom, left) of its rounded-rect parent. The rect hugs the parent's edge, so the
// visible 1.5px rim is the stroke's inner half. pathLength=100 makes dash length and speed independent of the size, and at 8s per
// loop one unit is 0.08s. With reduced motion it rests as a static catch.
// Every dash is `[start, length]` along the path: a white head with a soft blurred copy so it reads as a reflection, trailed by a
// tail built from a few shorter dashes that all end at the head, so it fades in steps toward the head and ends cleanly.
// The mobile key keeps the older single warm tail.
const CTA_LIGHT = { head: [7, 5], tail: [[0, 12, 0.08], [4, 8, 0.12], [8, 4, 0.18]] } as const;

function EdgeLight({ radius, crisp = false }: { radius: number; crisp?: boolean }) {
  const rim = { x: 0, y: 0, width: "100%", height: "100%", rx: radius, fill: "none", pathLength: 100 } as const;
  const run = "animate-cta-trace motion-reduce:animate-none";
  const dash = (start: number, length: number) => ({
    strokeDasharray: `${length} ${100 - length}`,
    strokeDashoffset: -start,
    style: { animationDelay: `-${(start * 0.08).toFixed(2)}s` },
    className: run,
  });
  if (crisp) {
    const [headStart, headLength] = CTA_LIGHT.head;
    return (
      <svg aria-hidden className="pointer-events-none absolute inset-0 z-10 size-full">
        {CTA_LIGHT.tail.map(([start, length, opacity]) => (
          <rect key={start} {...rim} stroke="rgb(255 244 238)" strokeOpacity={opacity} strokeWidth="3" {...dash(start, length)} />
        ))}
        <rect {...rim} stroke="white" strokeWidth="3" {...dash(headStart, headLength)} />
        <rect {...rim} stroke="white" strokeOpacity="0.5" strokeWidth="6" {...dash(headStart, headLength)} className={cn(run, "blur-[2px]")} />
      </svg>
    );
  }
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-10 size-full">
      <rect {...rim} stroke="rgb(255 214 196)" strokeOpacity="0.45" strokeWidth="3" {...dash(0, 16)} />
      <rect {...rim} stroke="white" strokeWidth="3" {...dash(11, 5)} />
      <rect {...rim} stroke="white" strokeOpacity="0.5" strokeWidth="6" {...dash(11, 5)} className={cn(run, "blur-[2px]")} />
    </svg>
  );
}

// Light catching the top edge of the Ink docks: a thin lit line that fades out, never a wash or an outline. The parent clips to the
// dock's 18px corner radius, which both docks share.
function CornerCatch({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <span aria-hidden className={cn("pointer-events-none absolute top-0", left ? "left-0" : "right-0")}>
      <span
        className={cn(
          "block h-12 w-16 border-t border-[rgb(255_176_140/0.85)]",
          left
            ? "rounded-tl-[1.125rem] border-l [mask-image:radial-gradient(circle_at_0_0,#000_0,transparent_52px)]"
            : "ml-auto rounded-tr-[1.125rem] border-r [mask-image:radial-gradient(circle_at_100%_0,#000_0,transparent_52px)]",
        )}
      />
    </span>
  );
}

// A short lit stretch of the flat top edge; `fade` says which end stays bright.
function TopCatch({ className, fade }: { className: string; fade: "both" | "left" | "right" }) {
  const line = {
    both: "bg-[linear-gradient(90deg,transparent,rgb(255_176_140/0.8),transparent)]",
    left: "bg-[linear-gradient(90deg,rgb(255_176_140/0.8),transparent)]",
    right: "bg-[linear-gradient(90deg,transparent,rgb(255_176_140/0.8))]",
  }[fade];
  return <span aria-hidden className={cn("pointer-events-none absolute top-0 h-px", line, className)} />;
}

const subscribeToScroll = (onChange: () => void) => {
  let frame = 0;
  const scheduleUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  };
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  const observer = new ResizeObserver(scheduleUpdate);
  observer.observe(document.body);
  return () => {
    window.removeEventListener("scroll", scheduleUpdate);
    window.removeEventListener("resize", scheduleUpdate);
    window.cancelAnimationFrame(frame);
    observer.disconnect();
  };
};
const scrolledHalfway = () => {
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  return scrollableHeight > 0 && window.scrollY / scrollableHeight >= 0.5;
};
const notScrolledOnServer = () => false;

function TopButton({ hidden, className, mobile = false }: { hidden: boolean; className: string; mobile?: boolean }) {
  const scrolled = useSyncExternalStore(subscribeToScroll, scrolledHalfway, notScrolledOnServer);
  const visible = scrolled && !hidden;
  return (
    <button
      type="button"
      inert={!visible}
      style={mobile ? { bottom: `calc(${BAR} + env(safe-area-inset-bottom) + 2.25rem)` } : undefined}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className={cn(
        "fixed z-40 cursor-pointer items-center gap-2 rounded-full border border-canvas/15 bg-foreground font-medium text-canvas shadow-[0_8px_20px_-8px_color-mix(in_oklab,var(--foreground)_60%,transparent)] interact transition-[opacity,translate,background-color] hover:bg-foreground/90 motion-reduce:translate-y-0 motion-reduce:transition-none",
        mobile ? "h-10 py-1 pl-1 pr-3 text-[0.8125rem]" : "h-11 p-1.5 text-nav min-[1200px]:pr-4",
        className,
        focusRing,
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <span className="flex size-[1.875rem] items-center justify-center rounded-full bg-brand text-white">
        <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
      </span>
      <span className={mobile ? undefined : "sr-only min-[1200px]:not-sr-only"}>{mobile ? "Top" : "Back to Top"}</span>
    </button>
  );
}

// ---------------------------------------------------------------- desktop

// Active and open share one signal: Vermilion text with a small bar under the label.
const dockLink = cn(
  "group inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-xl text-base font-medium text-canvas/85 interact transition-colors hover:text-brand data-[current=true]:text-brand",
  focusRing,
);
const dockLabel =
  "relative after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-current after:opacity-0 after:interact after:transition-opacity group-data-[current=true]:after:opacity-100";

// Pointer travel from More up to the panel must survive the dock padding and gap.
const CLOSE_DELAY_MS = 200;

function DesktopDock({ pathname, moreCurrent }: { pathname: string; moreCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const skipFocusOpen = useRef(false);
  const openNow = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Returning focus to More would otherwise re-open the panel through its focus handler.
      skipFocusOpen.current = true;
      trigger.current?.focus();
      skipFocusOpen.current = false;
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const item = ({ label, href }: NavLink) => (
    <li key={href} className="flex justify-center">
      <Link href={href} data-current={isCurrent(pathname, href)} aria-current={isCurrent(pathname, href) ? "page" : undefined} className={dockLink}>
        <span className={dockLabel}>{label}</span>
      </Link>
    </li>
  );
  return (
    <>
      {/* The page behind the open panel is softly blurred rather than dimmed. The blur is small and the layer is static (no fade), since
          animating a backdrop filter re-blurs the page every frame. It sits under the dock (z-40) and ignores the pointer. */}
      {open ? <div aria-hidden className="pointer-events-none fixed inset-0 z-30 hidden bg-white/15 backdrop-blur-[3px] min-[769px]:block" /> : null}
    <nav
      ref={nav}
      aria-label="Main"
      onFocus={(event) => {
        // Focus landing on another dock item dismisses the panel; focus on More or inside the panel keeps it.
        if (event.target !== trigger.current && !(event.target as Element).closest("#marketing-more-panel")) setOpen(false);
      }}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      className="fixed bottom-1.5 left-1/2 z-40 hidden w-[min(44.5rem,calc(100vw-2rem))] -translate-x-1/2 min-[769px]:block"
    >
      <ul className="grid h-[4.5rem] grid-cols-[1fr_1fr_11rem_1fr_1fr] items-center rounded-[18px] border border-white/10 bg-foreground p-2 shadow-[0_16px_40px_-16px_color-mix(in_oklab,var(--foreground)_65%,transparent)]">
        {leading.map(item)}
        <li>
          <CrystalCta />
        </li>
        {item(trailing)}
        <li className="flex justify-center">
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-controls="marketing-more-panel"
            data-current={open || moreCurrent}
            onPointerEnter={(event) => event.pointerType === "mouse" && openNow()}
            onPointerLeave={(event) => event.pointerType === "mouse" && closeSoon()}
            onFocus={() => !skipFocusOpen.current && openNow()}
            onClick={openNow}
            className={dockLink}
          >
            <span className="relative">More</span>
          </button>
        </li>
      </ul>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[4.5rem] overflow-hidden rounded-[18px]">
        <CornerCatch side="left" />
        <CornerCatch side="right" />
        <TopCatch className="left-1/2 w-32 -translate-x-1/2" fade="both" />
      </div>
      {open ? <MorePanel pathname={pathname} onNavigate={() => setOpen(false)} onHover={openNow} onLeave={closeSoon} /> : null}
    </nav>
    <TopButton hidden={open} className="bottom-[calc(env(safe-area-inset-bottom)+7.5rem)] left-6 hidden min-[769px]:inline-flex min-[900px]:bottom-[2.375rem] min-[900px]:left-8" />
    </>
  );
}

// Polished-material treatment, local to this one action: one narrow light travelling the edge, a fixed top-right reflection, a soft inner edge.
// The arrow only rotates (↗ toward →) on hover or focus, so nothing moves in the layout.
function CrystalCta() {
  return (
    <Link
      href={GET_NEFFI_HREF}
      className={cn("group relative isolate block h-14 w-full overflow-hidden rounded-xl bg-white/[0.08] p-[1.5px] shadow-[0_8px_20px_-8px_rgb(214_64_45/0.7)]", focusRing)}
    >
      <span className="relative flex h-full items-center justify-center overflow-hidden rounded-[10.5px] bg-action text-base font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-12px_16px_-12px_rgb(0_0_0/0.35)] interact transition-colors group-hover:bg-action-hover group-focus-visible:bg-action-hover">
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_58%,rgb(255_255_255/0.1)_66%,transparent_74%)]" />
        <span aria-hidden className="pointer-events-none absolute -top-8 -right-6 size-20 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.3),transparent)]" />
        <span className="relative">Get Neffi</span>
        <ArrowUpRight
          aria-hidden
          className="relative ml-1.5 size-[1.125rem] transition-transform duration-700 ease-out group-hover:rotate-45 group-focus-visible:rotate-45 motion-reduce:transition-none"
          strokeWidth={2.25}
        />
      </span>
      <EdgeLight radius={12} crisp />
    </Link>
  );
}

function MorePanel({ pathname, onNavigate, onHover, onLeave }: { pathname: string; onNavigate: () => void; onHover: () => void; onLeave: () => void }) {
  return (
    <>
      {/* The bottom padding is a transparent bridge to the dock, so the pointer never leaves the hover area crossing the gap. */}
      <div
        id="marketing-more-panel"
        onPointerEnter={(event) => event.pointerType === "mouse" && onHover()}
        onPointerLeave={(event) => event.pointerType === "mouse" && onLeave()}
        className="absolute bottom-full left-1/2 w-[min(52.5rem,calc(100vw-2rem))] -translate-x-1/2 pb-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
      >
        <div className="flex max-h-[calc(100dvh-10rem)] min-h-[min(35rem,calc(100dvh-10rem))] gap-8 overflow-y-auto rounded-2xl border border-border bg-canvas p-4 shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--foreground)_45%,transparent)]">
          {/* Sample visual until the marketing imagery is final. */}
          <div className="relative w-[46%] shrink-0 self-stretch overflow-hidden rounded-xl bg-subtle">
            <Image src="/images/neffi-activation-hero-mobile.png" alt="" fill sizes="400px" className="object-cover object-[50%_58%]" />
          </div>
          <ul className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pr-2">
            {moreLinks.map(({ label, href, description }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={isCurrent(pathname, href) ? "page" : undefined}
                  className={cn("group flex items-center justify-between gap-4 rounded-xl px-4 py-4 interact transition-colors hover:bg-[color-mix(in_oklab,var(--brand)_5%,var(--canvas))] focus-visible:bg-[color-mix(in_oklab,var(--brand)_5%,var(--canvas))]", focusRing, "focus-visible:-outline-offset-2")}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[1.125rem] leading-6 font-medium text-foreground interact transition-colors group-hover:text-action-text group-focus-visible:text-action-text group-aria-[current=page]:text-action-text">
                      {label}
                    </span>
                    <span className="text-body text-fg-secondary">{description}</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-[1.125rem] shrink-0 text-action-text opacity-0 interact transition-[opacity,translate] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:opacity-100"
                    strokeWidth={1.75}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Points at the More column: the dock grid is four flexible columns around the 11rem action, inside 0.5rem padding. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-[calc(0.5rem+(100%-12rem)/8)] bottom-[calc(100%+0.5rem)] size-3.5 translate-x-1/2 rotate-45 rounded-br-[3px] border-r border-b border-border bg-canvas"
      />
    </>
  );
}

// ---------------------------------------------------------------- mobile

// Bar content height, above the safe-area inset; the sheet extends behind the bar and pads its list by this.
const BAR = "5.5rem";

// Active tabs (current route, or More while its sheet is open) switch icon and label to Vermilion.
const tabClass = cn(
  "flex h-full flex-col items-center justify-start gap-1.5 pt-5 text-[0.75rem] leading-none font-medium text-canvas/75 interact transition-colors hover:text-canvas aria-[current=page]:text-brand data-[active=true]:text-brand",
  focusRing,
  "focus-visible:-outline-offset-2",
);

// Dock top edge in a 140x50 box: 28px of flat edge each side, then a recess 68 wide and 41 deep that hugs the 62px key (3px of air
// each side and below). The 22px inner corners are concentric with the key's 18px corners; 11px straight walls, 8px fillets.
// The flats are part of this path so the lit edge flows from the straight top into the recess without a join.
const NOTCH_EDGE = "M0 0H28A8 8 0 0 1 36 8V19A22 22 0 0 0 58 41H82A22 22 0 0 0 104 19V8A8 8 0 0 1 112 0H140";

// Official transparent symbol made for Vermilion (Snow mark, Ink dot). It sits on a 512px canvas with the mark ~58% wide, so it is
// drawn at 52px to read ~30px across. This is the only place to change if the symbol asset changes.
function CenterMark() {
  return <Image src="/neffi-mark-on-vermilion.svg" alt="" width={52} height={52} unoptimized className="relative max-w-none shrink-0 drop-shadow-[0_1px_1px_rgb(120_28_16/0.35)]" />;
}

// Raised key: lit rim, face shading toward a darker lower edge, fixed top-right reflection. Glow and smoke sit behind
// the bar (negative z), so they only show through the notch and above the bar.
function CenterKey() {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute top-5 left-1/2 -z-10 h-8 w-14 -translate-x-1/2 rounded-full bg-[rgb(230_74_53/0.5)] blur-lg" />
      <span aria-hidden className="pointer-events-none absolute -top-6 left-1/2 -z-10 ml-3 size-12 rounded-full bg-[rgb(255_150_110/0.22)] blur-xl" />
      <Link
        href={GET_NEFFI_HREF}
        aria-label="Get Neffi"
        className={cn(
          "group absolute -top-6 left-1/2 isolate block size-[3.875rem] -translate-x-1/2 overflow-hidden rounded-[1.125rem] bg-white/15 p-[1.5px] shadow-[0_10px_18px_-6px_rgb(150_36_22/0.65)] interact transition-transform active:translate-y-px active:scale-[0.97]",
          focusRing,
        )}
      >
        <span className="relative flex size-full items-center justify-center overflow-hidden rounded-[calc(1.125rem-1.5px)] bg-linear-to-b from-brand via-action to-[#BE3320] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-3px_0_rgb(120_28_16/0.4)]">
          <span aria-hidden className="pointer-events-none absolute -top-5 -right-5 size-14 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.42),transparent)]" />
          <CenterMark />
        </span>
        <EdgeLight radius={18} />
      </Link>
    </div>
  );
}

function MobileBar({ pathname, moreCurrent }: { pathname: string; moreCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 769px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const tab = ({ label, href, icon: Icon }: NavLink) => (
    <li key={href}>
      <Link href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} className={tabClass}>
        <Icon aria-hidden className="size-[1.5625rem]" strokeWidth={1.6} />
        {label}
      </Link>
    </li>
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[60] min-[769px]:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {/* One Ink surface from edge to edge, safe area included, with rounded top corners. It is built from three pieces so the middle can
            carry the recess; the centre overlaps its neighbours by 1px so no seam shows. Warm light only catches the top corners and the recess shoulders. */}
        <div aria-hidden className="absolute inset-0 flex">
          <div className="relative flex-1 overflow-hidden rounded-tl-[1.125rem] border-t border-white/10 bg-foreground">
            <CornerCatch side="left" />
          </div>
          <div className="relative -mx-px w-[calc(8.75rem+2px)] shrink-0 px-px">
            <svg viewBox="0 0 140 50" className="absolute inset-x-px top-0 h-[50px] w-[calc(100%-2px)] overflow-visible">
              <defs>
                <linearGradient id="marketing-notch-edge" gradientUnits="userSpaceOnUse" x1="0" x2="140" y1="0" y2="0">
                  <stop offset="0" stopColor="rgb(255 176 140)" stopOpacity="0" />
                  <stop offset="0.26" stopColor="rgb(255 176 140)" stopOpacity="0.85" />
                  <stop offset="0.5" stopColor="rgb(240 90 60)" stopOpacity="0.6" />
                  <stop offset="0.74" stopColor="rgb(255 176 140)" stopOpacity="0.85" />
                  <stop offset="1" stopColor="rgb(255 176 140)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="marketing-notch-fade" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="34">
                  <stop offset="0.3" stopColor="white" />
                  <stop offset="1" stopColor="black" />
                </linearGradient>
                <mask id="marketing-notch-mask" maskUnits="userSpaceOnUse" x="0" y="-2" width="140" height="52">
                  <rect x="0" y="-2" width="140" height="52" fill="url(#marketing-notch-fade)" />
                </mask>
              </defs>
              <path d={`${NOTCH_EDGE}V50H0Z`} className="fill-foreground" />
              <path d={NOTCH_EDGE} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="1" transform="translate(0 .5)" />
              <g mask="url(#marketing-notch-mask)">
                <path d={NOTCH_EDGE} fill="none" stroke="url(#marketing-notch-edge)" strokeWidth="1" transform="translate(0 .5)" />
              </g>
            </svg>
            <div className="absolute inset-x-0 top-[48px] bottom-0 bg-foreground" />
          </div>
          <div className="relative flex-1 overflow-hidden rounded-tr-[1.125rem] border-t border-white/10 bg-foreground">
            <CornerCatch side="right" />
          </div>
        </div>
        <ul className="relative mx-auto grid h-[5.5rem] max-w-lg grid-cols-[1fr_1fr_5.625rem_1fr_1fr]">
          {leading.map(tab)}
          <li className="relative">
            <CenterKey />
          </li>
          {tab(trailing)}
          <li>
            <SheetTrigger aria-current={moreCurrent ? "page" : undefined} data-active={open || moreCurrent} className={cn(tabClass, "w-full cursor-pointer")}>
              <Ellipsis aria-hidden className="size-[1.5625rem]" strokeWidth={1.6} />
              More
            </SheetTrigger>
          </li>
        </ul>
      </nav>
      <SheetContent
        side="bottom"
        data-marketing-more=""
        showCloseButton={false}
        overlayClassName="bg-foreground/[0.06] transition-none"
        className="z-[55] max-h-[calc(100dvh-3rem)] gap-0 overflow-y-auto overscroll-contain rounded-t-2xl border-x border-border-strong bg-canvas shadow-[0_-8px_28px_-12px_rgb(17_17_19/0.25)] min-[769px]:hidden"
      >
        <SheetTitle className="sr-only">More</SheetTitle>
        <SheetDescription className="sr-only">Help and account links</SheetDescription>
        <ul className="divide-y divide-border px-6 pt-4" style={{ paddingBottom: `calc(${BAR} + env(safe-area-inset-bottom) + 2.25rem)` }}>
          {moreLinks.map(({ label, description, href }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                aria-current={isCurrent(pathname, href) ? "page" : undefined}
                className={cn("group flex min-h-[4.25rem] items-center justify-between gap-4 py-3.5", focusRing, "focus-visible:-outline-offset-2")}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[1.0625rem] leading-6 font-medium text-foreground interact transition-colors group-active:text-action-text group-focus-visible:text-action-text group-aria-[current=page]:text-action-text">
                    {label}
                  </span>
                  <span className="truncate text-meta text-fg-secondary">{description}</span>
                </span>
                <ArrowUpRight aria-hidden className="size-[1.125rem] shrink-0 text-fg-faint interact transition-colors group-active:text-action-text group-focus-visible:text-action-text" strokeWidth={1.6} />
              </Link>
            </li>
          ))}
        </ul>
      </SheetContent>
      <TopButton hidden={open} mobile className="left-6 inline-flex min-[769px]:hidden" />
    </Sheet>
  );
}
