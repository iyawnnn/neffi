import { getImageProps } from "next/image";

const HEROES = {
  activate: {
    desktop: { src: "/images/neffi-activation-hero-desktop.png", width: 1672, height: 941 },
    mobile: { src: "/images/neffi-activation-hero-mobile.png", width: 1024, height: 1536 },
    className: "h-full w-full object-cover object-[center_28%] md:object-center",
  },
  signin: {
    desktop: { src: "/images/neffi-signin-hero-desktop.png", width: 1440, height: 1500 },
    mobile: { src: "/images/neffi-signin-hero-mobile.png", width: 1536, height: 1024 },
    className: "h-full w-full object-cover object-center scale-[1.06] origin-center md:scale-100 md:object-top lg:object-center",
  },
} as const;

// The raw hero PNGs are ~2 MB each. getImageProps routes them through the Next optimizer (AVIF/WebP at the width
// actually shown) while keeping the art-directed <picture>; fetchPriority makes the visible hero the LCP candidate.
export function AuthHero({ kind }: { kind: keyof typeof HEROES }) {
  const { desktop, mobile, className } = HEROES[kind];
  const common = { alt: "", sizes: "(min-width: 768px) 540px, min(100vw, 440px)", quality: 80, fetchPriority: "high" as const };
  const { props: { srcSet: desktopSrcSet } } = getImageProps({ ...common, ...desktop });
  const { props: image } = getImageProps({ ...common, ...mobile });
  return (
    <picture className="block h-full w-full">
      <source media="(min-width: 768px)" srcSet={desktopSrcSet} sizes={common.sizes} />
      <img {...image} alt="" className={`${className} pointer-events-none select-none`} />
    </picture>
  );
}
