"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { LinkKindIcon } from "@/components/social-icons";
import { DigitalProfilePreview, demoIdentity, demoLinks } from "../profile-preview";

type Focus = "identity" | "links" | "contact";

const tabs: { id: Focus; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "links", label: "Links" },
  { id: "contact", label: "Contact" },
];

const destinations = [
  { kind: "portfolio", label: "Portfolio" },
  { kind: "booking", label: "Book a call" },
] as const;
const profileLinks = [...destinations, { kind: "contact", label: "Contact" }] as const;

// What the product has for contact (the profiles spec): a Save contact action carrying the profile's email and phone, and a
// message form.
const contactOptions = [
  { label: "Save contact", hint: "Adds your details to their phone" },
  { label: "Email", hint: "Included when they save your contact" },
  { label: "Phone", hint: "Included when they save your contact" },
  { label: "Contact form", hint: "Lets people send you a message" },
];

// Editor and result: the tabs are the only control. They swap the editor rows and mark the matching part of the live profile,
// which always stays complete. Nothing here is typeable, navigates or downloads.
export function ProductMakeItYours() {
  const [focus, setFocus] = useState<Focus>("identity");

  return (
    <section aria-labelledby="make-it-yours-heading" className="pp-section pp-studio-section">
      <div className="pp-container">
        <div className="pp-section-head">
          <h2 id="make-it-yours-heading" className="pp-heading pp-studio-heading">
            <span>Make it yours.</span> <span>Build your profile your way.</span>
          </h2>
          <p className="pp-support">Build a profile around the details, links, and places you actually want people to reach.</p>
        </div>

        <div className="pp-studio">
          <div className="pp-studio-editor">
            <div className="pp-studio-head">
              <p>Edit profile</p>
              <div className="pp-studio-tabs" role="group" aria-label="Profile sections">
                {tabs.map(({ id, label }) => (
                  <button key={id} type="button" aria-pressed={focus === id} onClick={() => setFocus(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="pp-studio-rows" aria-label={`${focus} settings`}>
              {focus === "identity" ? (
                <>
                  <Row label="Photo">
                    <span className="pp-studio-photo">
                      <Image src={demoIdentity.image!.url} alt="" width={40} height={40} />
                    </span>
                    {demoIdentity.fullName}
                    <span className="pp-studio-aside">Change</span>
                  </Row>
                  <Row label="Name">{demoIdentity.fullName}</Row>
                  <Row label="Headline">{demoIdentity.headline}</Row>
                  <Row label="Location">{demoIdentity.location}</Row>
                </>
              ) : focus === "links" ? (
                [...destinations, ...demoLinks].map(({ kind, label }) => (
                  <li key={kind} className="pp-studio-row pp-studio-inline">
                    <LinkKindIcon kind={kind} className="pp-studio-icon" />
                    <span className="pp-studio-value">{label}</span>
                    <GripVertical aria-hidden="true" size={16} className="pp-studio-aside" />
                  </li>
                ))
              ) : (
                contactOptions.map(({ label, hint }) => (
                  <li key={label} className="pp-studio-row pp-studio-inline">
                    <span>
                      <span className="pp-studio-value">{label}</span>
                      <span className="pp-studio-hint">{hint}</span>
                    </span>
                    <span role="img" aria-label="On" className="pp-studio-switch" />
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="pp-studio-preview" data-focus={focus}>
            <p className="pp-annotation">Live preview</p>
            <div role="img" aria-label={`Sample profile preview for Mika Santos, ${focus} highlighted`}>
              <div inert>
                <DigitalProfilePreview identity={demoIdentity} links={profileLinks} quickLinks={demoLinks} contactAction={{ label: "Save contact" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="pp-studio-row">
      <span className="pp-field-label">{label}</span>
      <span className="pp-studio-value">{children}</span>
    </li>
  );
}
