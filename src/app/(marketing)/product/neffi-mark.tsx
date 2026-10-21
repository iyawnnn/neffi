import Image from "next/image";

// The approved mark asset is an 800x800 Snow canvas; this crops it to the glyph (x 260–540, y 290–530) so it can be sized freely.
export function NeffiMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`pp-mark ${className}`}>
      <Image src="/neffi-mark-ink.svg" alt="" width={800} height={800} unoptimized />
    </span>
  );
}
