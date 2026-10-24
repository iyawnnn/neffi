import Image from "next/image";
import { ArrowDown, ArrowRight } from "lucide-react";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { updatedMarketingProfile } from "./product-profile-fixture";

export function ProductProfileEvolution() {
  return (
    <section aria-labelledby="profile-evolution-heading" className="pp-section pp-studio-section pp-evolution-section">
      <div className="pp-container">
        <div className="pp-section-head">
          <h2 id="profile-evolution-heading" className="pp-heading pp-studio-heading">
            <span>Keep the card.</span> <span>Change the profile.</span>
          </h2>
          <p className="pp-support">Update your role, links, and work whenever you need to. The Neffi card you already carry stays the same.</p>
        </div>

        <div className="pp-evolution-visual">
          <figure className="pp-evolution-card">
            <Image src="/neffi-card-front-preview.svg" alt="White Neffi NFC card" width={324} height={205} sizes="(min-width: 900px) 340px, 280px" />
            <figcaption className="pp-evolution-label">Same physical card</figcaption>
          </figure>
          <div className="pp-evolution-connector" aria-hidden="true">
            <ArrowRight className="pp-evolution-arrow-right" size={20} strokeWidth={1.5} />
            <ArrowDown className="pp-evolution-arrow-down" size={20} strokeWidth={1.5} />
          </div>
          <figure className="pp-studio-preview pp-evolution-profile">
            <div className="pp-studio-profile-frame" role="img" aria-label="Sample updated Neffi Classic profile for Mika Santos, Senior Brand Designer">
              <div className="pp-studio-profile-scale" inert>
                <ProfileRenderer view={updatedMarketingProfile} />
              </div>
            </div>
            <figcaption className="pp-evolution-label">Updated digital profile</figcaption>
          </figure>
        </div>

        <dl className="pp-change-summary">
          <div>
            <dt className="pp-annotation">Role</dt>
            <dd>
              <span className="pp-change-before">Brand Designer</span>
              <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
              <span className="sr-only">to</span>
              <span>Senior Brand Designer</span>
            </dd>
          </div>
          <div>
            <dt className="pp-annotation">Work</dt>
            <dd>
              <span className="pp-change-before">Portfolio</span>
              <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
              <span className="sr-only">to</span>
              <span>Latest case study</span>
            </dd>
          </div>
          <div>
            <dt className="pp-annotation">New link</dt>
            <dd>
              <span aria-hidden="true" className="pp-change-added">+</span>
              <span className="sr-only">Added:</span>
              <span>Book a call</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
