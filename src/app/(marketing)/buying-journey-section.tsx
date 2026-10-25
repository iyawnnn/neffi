import "./buying-journey-section.css";

const buyingSteps = [
  { title: "Message us", copy: "Message us on Facebook to start your Neffi order." },
  { title: "Confirm and pay", copy: "We’ll confirm your order and send the payment details." },
  { title: "We pack and ship", copy: "Once confirmed, we’ll prepare your Neffi and ship it through J&T." },
  { title: "Track your order", copy: "We’ll send your J&T tracking number for delivery updates." },
];

export function BuyingJourneySection({ id }: { id?: string } = {}) {
  return (
    <section id={id} className="mp-section guide-buying" aria-labelledby="buying-heading">
      <div className="mp-container">
        <div className="guide-buying-head">
          <h2 id="buying-heading" className="mp-heading">Getting your Neffi is simple.</h2>
          <p className="guide-buying-lead">Order through a conversation. We’ll take it from there.</p>
        </div>
        <ol className="guide-journey guide-buying-journey">
          {buyingSteps.map(({ title, copy }, index) => (
            <li key={title} className="guide-buying-step">
              <span className="guide-buying-number" aria-hidden="true">0{index + 1}</span>
              <h3 className="guide-step-title">{title}</h3>
              <p className="guide-step-copy">{copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
