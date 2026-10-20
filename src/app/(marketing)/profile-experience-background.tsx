import Image from "next/image";

const backgrounds = [
  { mode: "profile", src: "/marketing/profile-experience/neffi-profile-background.png" },
  { mode: "contact", src: "/marketing/profile-experience/neffi-save-contact-background.png" },
  { mode: "links", src: "/marketing/profile-experience/neffi-share-work-background.png" },
] as const;

export function ProfileExperienceBackground() {
  return (
    <div className="pe-background" aria-hidden="true">
      {backgrounds.map(({ mode, src }) => (
        <Image key={mode} src={src} alt="" fill sizes="(min-width: 1056px) 960px, 100vw" loading="eager" className={`pe-background-image pe-background-${mode}`} />
      ))}
    </div>
  );
}
