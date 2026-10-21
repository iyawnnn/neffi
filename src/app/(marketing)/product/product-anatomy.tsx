import Image from "next/image";

// Placed around the card in product.css; each leader runs only the last short distance to the card's nearest edge.
const callouts = [
  { id: "link", label: "Permanent link", title: "Set up once", copy: "The link on your card stays the same." },
  { id: "nfc", label: "NFC", title: "Tap to open", copy: "Hold the card near a compatible phone to open your profile." },
  { id: "activation", label: "Activation", title: "Yours from the box", copy: "Use the activation code inside your Neffi package to connect the card to your profile." },
];

// The page's one physical-card moment: the real artwork, front-facing, on a set-back edge plate that reads as card stock.
export function ProductAnatomy() {
  return (
    <section aria-labelledby="anatomy-heading" className="pp-section">
      <div className="pp-container">
        <div className="pp-anatomy-intro">
          <h2 id="anatomy-heading" className="pp-heading">What&apos;s in your hand.</h2>
          <p className="pp-anatomy-lede">One card. One permanent link. One profile.</p>
          <p className="pp-support">Nothing to install, and no need to rewrite the card when your details change.</p>
        </div>

        <div className="pp-anatomy-stage">
          <div className="pp-card" role="img" aria-label="The Neffi card, front">
            <span className="pp-card-face">
              <Image src="/neffi-card-front-preview.svg" alt="" fill unoptimized sizes="(min-width: 769px) 36rem, 90vw" />
            </span>
          </div>
          {callouts.map(({ id, label, title, copy }) => (
            <div key={id} className={`pp-callout pp-callout-${id}`}>
              <p className="pp-annotation">{label}</p>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          ))}
        </div>
        <p className="pp-anatomy-note">No card with you? Your profile also has a QR code you can show from your phone.</p>
      </div>
    </section>
  );
}
