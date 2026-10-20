import type { ReactNode } from "react";
import { Check, IdCard, Minus, QrCode, X } from "lucide-react";
import { NeffiMark } from "./neffi-mark";

// Three approaches, as defined by their names: a printed card alone, a QR-linked profile with no card, and Neffi. Neffi's row only
// claims what PRODUCT.md and decisions 0001 and 0004 support (NFC tap, editable profile, on-screen Sharing QR). "Limited" keeps
// the old "limited by print space" meaning for a paper card's links.
type Mark = "yes" | "no" | "limited";

const capabilities = ["Physical handoff", "Edit after sharing", "Tap to share", "Multiple links", "QR access"];

const options: { name: string; detail: string; icon: ReactNode; marks: Mark[]; featured?: boolean }[] = [
  { name: "Paper-only card", detail: "Print only", icon: <IdCard strokeWidth={1.6} />, marks: ["yes", "no", "no", "limited", "no"] },
  { name: "QR-only profile", detail: "Screen only", icon: <QrCode strokeWidth={1.6} />, marks: ["no", "yes", "no", "yes", "yes"] },
  { name: "Neffi", detail: "Card + profile", icon: <NeffiMark className="pp-matrix-mark" />, marks: ["yes", "yes", "yes", "yes", "yes"], featured: true },
];

const markIcon = { yes: Check, no: X, limited: Minus };
const markLabel = { yes: "Supported", no: "Not supported", limited: "Limited" };

export function ProductComparison() {
  return (
    <section aria-labelledby="comparison-heading" className="pp-section pp-section-minor">
      <div className="pp-container">
        <div className="pp-section-head">
          <div>
            <p className="pp-eyebrow">Why both?</p>
            <h2 id="comparison-heading" className="pp-statement pp-comparison-statement">
              Physical when it matters.
              <br />
              <span>Digital when it changes.</span>
            </h2>
          </div>
          <p className="pp-support">Neffi combines the presence of a physical card with a profile you can keep up to date.</p>
        </div>

        {/* A div table (ARIA table roles) rather than <table>, so each option row can be one continuous container. On small
          screens it scrolls sideways with the option column pinned. */}
        <div className="pp-matrix-scroll">
          <div role="table" aria-label="How a paper-only card, a QR-only profile and Neffi compare" className="pp-matrix">
            <div role="row" className="pp-matrix-row pp-matrix-head">
              <span role="columnheader" className="pp-matrix-option"><span className="sr-only">Approach</span></span>
              {capabilities.map((capability) => (
                <span key={capability} role="columnheader">{capability}</span>
              ))}
            </div>
            {options.map(({ name, detail, icon, marks, featured }) => (
              <div key={name} role="row" className={`pp-matrix-row${featured ? " pp-matrix-featured" : ""}`}>
                <span role="rowheader" className="pp-matrix-option">
                  <span aria-hidden="true" className="pp-matrix-tile">{icon}</span>
                  <span className="pp-matrix-name">
                    {name}
                    <span>{detail}</span>
                  </span>
                </span>
                {marks.map((mark, index) => {
                  const Icon = markIcon[mark];
                  return (
                    <span key={capabilities[index]} role="cell" className={`pp-matrix-cell pp-matrix-${mark}`}>
                      <Icon aria-hidden="true" />
                      <span className="sr-only">{markLabel[mark]}</span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
