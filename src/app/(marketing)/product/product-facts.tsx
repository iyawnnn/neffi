// Only behaviour Neffi has today (PRODUCT.md, the profiles spec and decisions 0001 and 0004). No materials, sizes or chip details.
const facts = [
  { term: "No app required", detail: "Your profile opens in the phone's browser. Nothing to download." },
  { term: "Tap or scan", detail: "Tap the card, or show your profile's QR code from your screen." },
  { term: "Editable anytime", detail: "Change your details, links, and work whenever you need to." },
  { term: "One permanent link", detail: "The card's link never changes, so the card never needs replacing." },
  { term: "Activation", detail: "Connect the card to your profile with the code inside your package." },
];

export function ProductFacts() {
  return (
    <section aria-labelledby="facts-heading" className="pp-section pp-section-minor">
      <div className="pp-container pp-facts">
        <h2 id="facts-heading" className="pp-heading">Product facts.</h2>
        <dl>
          {facts.map(({ term, detail }) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
