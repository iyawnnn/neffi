import Image from "next/image";
import "./setup-journey.css";

const steps = [
  {
    id: "activate",
    title: "Activate your card",
    description: "Start with the code inside your Neffi package.",
    image: "/marketing/setup/neffi-setup-activate.svg",
    width: 600,
    height: 420,
  },
  {
    id: "profile",
    title: "Make it yours",
    description: "Add the details, links, and places you want people to reach.",
    image: "/marketing/setup/neffi-setup-profile-builder.svg",
    width: 700,
    height: 420,
  },
  {
    id: "share",
    title: "Start sharing",
    description: "Tap or scan whenever you’re ready to connect.",
    image: "/marketing/setup/neffi-setup-share.svg",
    width: 650,
    height: 420,
  },
];

export function SetupJourneySection() {
  return (
    <section aria-labelledby="setup-journey-heading" className="setup-journey-section bg-canvas">
      <div className="sj-content">
        <h2 id="setup-journey-heading" className="sj-heading">
          From the box to your first tap.
        </h2>
        <div className="sj-journey">
          <ol className="sj-steps" role="list">
            {steps.map((step) => (
              <li key={step.id} className={`sj-step sj-step--${step.id}`}>
                <div className="sj-art">
                  <Image
                    src={step.image}
                    alt=""
                    aria-hidden="true"
                    width={step.width}
                    height={step.height}
                    unoptimized
                    className="sj-illustration"
                  />
                </div>
                <div className="sj-caption">
                  <h3 className="sj-title">{step.title}</h3>
                  <p className="sj-description">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
