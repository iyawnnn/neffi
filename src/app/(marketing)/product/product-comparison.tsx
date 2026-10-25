import type { ReactNode } from "react";
import { Check, IdCard, QrCode, X } from "lucide-react";
import { NeffiMark } from "./neffi-mark";

// Three approaches, as defined by their names: a printed card alone, a QR-linked profile with no card, and Neffi. Neffi's row only
// claims what PRODUCT.md and decisions 0001 and 0004 support (NFC tap, editable profile, printed and on-screen Sharing QR). Every value is a
// check or an X; a paper card's printed space can't carry multiple links in the way a profile can.
type Mark = "yes" | "no";

const capabilities = ["Physical handoff", "Edit after sharing", "Tap to share", "Multiple links", "QR access"];

// Neffi, the featured option, comes first.
const options: { name: string; detail: string; icon: ReactNode; marks: Mark[]; featured?: boolean }[] = [
  { name: "Neffi", detail: "Card + profile", icon: <NeffiMark className="pp-matrix-mark" />, marks: ["yes", "yes", "yes", "yes", "yes"], featured: true },
  { name: "Paper-only card", detail: "Print only", icon: <IdCard strokeWidth={1.6} />, marks: ["yes", "no", "no", "no", "no"] },
  { name: "QR-only profile", detail: "Screen only", icon: <QrCode strokeWidth={1.6} />, marks: ["no", "yes", "no", "yes", "yes"] },
];

const markIcon = { yes: Check, no: X };
const markLabel = { yes: "Supported", no: "Not supported" };

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
              Digital when it changes.
            </h2>
          </div>
          <p className="pp-support">Neffi combines the presence of a physical card with a profile you can keep up to date.</p>
        </div>

        {/* A div table (ARIA table roles) rather than <table>, so each option row can be one continuous container. On small
          screens the whole matrix scrolls sideways. */}
        <div className="pp-matrix-scroll">
          <div role="table" aria-label="How Neffi, a paper-only card and a QR-only profile compare" className="pp-matrix">
            <div role="row" className="pp-matrix-row pp-matrix-head">
              <span role="columnheader" className="pp-matrix-option">Sharing method</span>
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
