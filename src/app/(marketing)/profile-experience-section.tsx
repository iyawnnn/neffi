import { ProfileExperienceStage } from "./profile-experience-stage";
import { ProfileScene } from "./profile-preview";
import { SaveContactScene } from "./save-contact-scene";
import { ShareWorkScene } from "./share-work-scene";
import { Reveal } from "./reveal";
import "./profile-experience.css";

export function ProfileExperienceSection() {
  return (
    <section aria-labelledby="profile-experience-heading" className="px-6 pt-[clamp(5rem,9vw,8rem)] pb-[clamp(6rem,10vw,9rem)]">
      <div className="pe-composition">
        <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between">
          <h2
            id="profile-experience-heading"
            className="text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-foreground min-[900px]:w-[44%]"
          >
            Your profile,
            <br />
            ready when they tap.
          </h2>
          <p className="max-w-[24rem] text-base leading-[1.6] text-fg-secondary min-[900px]:w-[38%]">
            One place for your contact details, links, and the ways people connect with you.
          </p>
        </div>
        <Reveal className="pe-reveal mt-10 min-[900px]:mt-16" animateOnMount>
          <ProfileExperienceStage scenes={{ profile: <ProfileScene />, contact: <SaveContactScene />, links: <ShareWorkScene /> }} />
        </Reveal>
      </div>
    </section>
  );
}
