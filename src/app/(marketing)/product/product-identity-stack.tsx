import type { CSSProperties, ReactNode } from "react";
import { CalendarDays, Link2, Mail, Phone, UserRound } from "lucide-react";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
import { Reveal } from "../reveal";

const glyph = (kind: "linkedin" | "instagram" | "dribbble") => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d={PLATFORMS[kind].brand!.path} /></svg>
);

const Bar = ({ size, ink = false }: { size: "long" | "mid" | "short"; ink?: boolean }) => <span className={`pp-bar pp-bar-${size}${ink ? " pp-bar-ink" : ""}`} />;
const Tile = ({ children }: { children: ReactNode }) => <span className="pp-tile">{children}</span>;

// The four identity layers, top to bottom. Content is abstract (bars and icons), like the planes of a product drawing; the
// callouts carry the words.
const layers: { id: string; content: ReactNode }[] = [
  {
    id: "name",
    content: (
      <span className="pp-layer-row">
        <span className="pp-layer-avatar"><UserRound /></span>
        <span className="pp-layer-lines"><Bar size="long" ink /><Bar size="mid" /></span>
        <span className="pp-layer-accent" />
      </span>
    ),
  },
  {
    id: "contact",
    content: (
      <>
        <span className="pp-layer-row"><Tile><Mail /></Tile><Bar size="long" /></span>
        <span className="pp-layer-row"><Tile><Phone /></Tile><Bar size="mid" /></span>
      </>
    ),
  },
  {
    id: "links",
    content: (
      <span className="pp-layer-row pp-layer-tiles">
        <Tile><Link2 /></Tile>
        <Tile>{glyph("linkedin")}</Tile>
        <Tile>{glyph("instagram")}</Tile>
        <Tile>{glyph("dribbble")}</Tile>
      </span>
    ),
  },
  {
    id: "booking",
    content: (
      <span className="pp-layer-row">
        <Tile><CalendarDays /></Tile>
        <span className="pp-layer-lines"><Bar size="mid" /><Bar size="short" /></span>
        <span className="pp-layer-action" />
      </span>
    ),
  },
];

// One callout per layer, alternating left and right down the stack. Each leader sits at its layer's centre height and ends
// beside that layer's outer corner.
const callouts: { layer: number; side: "left" | "right"; icon: ReactNode; title: string; copy: string }[] = [
  { layer: 0, side: "left", icon: <UserRound />, title: "Name + Role", copy: "Show who you are" },
  { layer: 1, side: "right", icon: <Mail />, title: "Contact Details", copy: "Make reaching you easy" },
  { layer: 2, side: "left", icon: <Link2 />, title: "Links + Socials", copy: "Keep your links together" },
  { layer: 3, side: "right", icon: <CalendarDays />, title: "Booking / Work", copy: "Make the next step easy" },
];

const at = (index: number) => ({ "--i": index }) as CSSProperties;

// An exploded stack of the identity layers behind one Neffi profile. Decorative: the hero copy already says what Neffi is.
export function ProductIdentityStack() {
  return (
    <Reveal className="pp-stack-stage" animateOnMount>
      <div aria-hidden="true" className="pp-stack">
        {layers.map(({ id, content }, index) => (
          <div key={id} className={`pp-layer pp-layer-${id}`} data-layer={index} style={at(index)}>
            <span className="pp-layer-edge" />
            <span className="pp-layer-face">{content}</span>
          </div>
        ))}
        {callouts.map(({ layer, side, icon, title, copy }) => (
          <div key={title} className={`pp-stack-callout pp-stack-callout-${side}`} data-layer={layer} style={at(layer)}>
            <span className="pp-stack-callout-icon">{icon}</span>
            <span className="pp-stack-callout-text">
              <span>{title}</span>
              <span>{copy}</span>
            </span>
            <span className="pp-stack-leader" />
          </div>
        ))}
      </div>
    </Reveal>
  );
}
