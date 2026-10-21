import type { ReactNode } from "react";
import { CalendarDays, FileText, FolderOpen, Globe, LayoutGrid, Link2, Mail, Phone, UserRoundPlus } from "lucide-react";
import { PLATFORMS } from "@/modules/profiles/platform-registry";

const platform = (kind: "linkedin" | "instagram" | "behance") => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d={PLATFORMS[kind].brand!.path} /></svg>
);

// Three representative examples per capability, all things a profile has today: the Contact block's Save contact with the
// identity email and phone; Portfolio and Booking link kinds and the identity website; social link kinds; Project blocks.
// Platform marks are monochrome so every quadrant carries the same visual weight.
const zones: { title: string; copy: string; items: { icon: ReactNode; label: string }[] }[] = [
  {
    title: "Contact details",
    copy: "Make it easy to save your details or get in touch.",
    items: [
      { icon: <UserRoundPlus />, label: "Save contact" },
      { icon: <Mail />, label: "Email" },
      { icon: <Phone />, label: "Phone" },
    ],
  },
  {
    title: "Your links",
    copy: "Send people to your website, booking page, or anywhere else that matters.",
    items: [
      { icon: <Globe />, label: "Portfolio" },
      { icon: <CalendarDays />, label: "Book a call" },
      { icon: <Link2 />, label: "Website" },
    ],
  },
  {
    title: "Your socials",
    copy: "The platforms you use, one tap from your profile.",
    items: [
      { icon: platform("linkedin"), label: "LinkedIn" },
      { icon: platform("instagram"), label: "Instagram" },
      { icon: platform("behance"), label: "Behance" },
    ],
  },
  {
    title: "Your work",
    copy: "Give new connections somewhere useful to go after you meet.",
    items: [
      { icon: <FileText />, label: "Latest case study" },
      { icon: <LayoutGrid />, label: "Selected work" },
      { icon: <FolderOpen />, label: "Client projects" },
    ],
  },
];

export function ProductCapabilities() {
  return (
    <section aria-labelledby="capabilities-heading" className="pp-section pp-section-minor">
      <div className="pp-container">
        <div className="pp-intro">
          <h2 id="capabilities-heading" className="pp-heading">What you can share.</h2>
          <p className="pp-support">Everything someone may need after a tap, kept in one profile.</p>
        </div>
        <ul className="pp-share">
          {zones.map(({ title, copy, items }) => (
            <li key={title} className="pp-share-zone">
              <h3>{title}</h3>
              <ul className="pp-share-items">
                {items.map(({ icon, label }) => (
                  <li key={label}>
                    <span aria-hidden="true">{icon}</span>
                    {label}
                  </li>
                ))}
              </ul>
              <p>{copy}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
