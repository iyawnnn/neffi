import { ArrowRight } from "lucide-react";
import { DigitalProfilePreview, demoIdentity, demoLinks } from "../profile-preview";

const updatedLinks = [
  { kind: "portfolio", label: "Latest case study" },
  { kind: "booking", label: "Book a call" },
  { kind: "contact", label: "Contact" },
] as const;

// What changed (left) beside the profile after those changes (right). Static: the layout itself tells the before and after.
export function ProductProfileEvolution() {
  return (
    <section aria-labelledby="profile-evolution-heading" className="pp-section pp-section-minor">
      <div className="pp-container pp-change">
        <div className="pp-change-intro">
          <h2 id="profile-evolution-heading" className="pp-statement">
            Keep the card.
            <br />
            Change the profile.
          </h2>
          <p className="pp-change-support">Update your role, links, and work whenever you need to. The Neffi card you already carry stays the same.</p>
        </div>

        <div className="pp-change-profile" role="img" aria-label="Sample Neffi profile for Mika Santos, Senior Brand Designer, with Latest case study, Book a call and Contact">
          <div inert>
            <DigitalProfilePreview identity={{ ...demoIdentity, headline: "Senior Brand Designer" }} links={updatedLinks} quickLinks={demoLinks} contactAction={{ label: "Save contact" }} />
          </div>
        </div>

        <div className="pp-change-list">
          <h3>What can change</h3>
          <dl>
            <div>
              <dt className="pp-annotation">Role</dt>
              <dd>
                <span className="pp-change-before">Brand Designer</span>
                <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
                <span className="sr-only">to</span>
                Senior Brand Designer
              </dd>
            </div>
            <div>
              <dt className="pp-annotation">Work</dt>
              <dd>
                <span className="pp-change-before">Portfolio</span>
                <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
                <span className="sr-only">to</span>
                Latest case study
              </dd>
            </div>
            <div>
              <dt className="pp-annotation">New link</dt>
              <dd>
                <span aria-hidden="true" className="pp-change-added">+</span>
                <span className="sr-only">Added:</span>
                Book a call
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
