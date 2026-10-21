import type { ReactNode } from "react";
import { AppWindow, KeyRound, Link2, Nfc, PencilLine } from "lucide-react";

// Only behaviour Neffi has today (PRODUCT.md, the profiles spec and decisions 0001 and 0004). No materials, sizes or chip details.
// The first two are the lead facts and get the larger treatment; the other three sit in a compact row beneath them.
const facts: { icon: ReactNode; title: string; detail: string; lead?: boolean }[] = [
  { icon: <AppWindow />, title: "No app required", detail: "Your profile opens directly in the browser.", lead: true },
  { icon: <Link2 />, title: "One permanent link", detail: "Your Neffi card keeps the same link as your profile changes.", lead: true },
  { icon: <Nfc />, title: "Tap or scan", detail: "Share by NFC or your profile QR code." },
  { icon: <PencilLine />, title: "Editable anytime", detail: "Change your details, links, and work whenever you need to." },
  { icon: <KeyRound />, title: "Simple activation", detail: "Connect your card using the code inside your package." },
];

export function ProductFacts() {
  return (
    <section aria-labelledby="facts-heading" className="pp-section pp-section-minor">
      <div className="pp-container">
        <h2 id="facts-heading" className="pp-heading pp-facts-heading">Product facts.</h2>
        <ul className="pp-facts">
          {facts.map(({ icon, title, detail, lead }) => (
            <li key={title} className={lead ? "pp-facts-lead" : undefined}>
              <span aria-hidden="true" className="pp-facts-icon">{icon}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
