"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { ArrowUpRight, Check, GripVertical, ImagePlus, MapPin } from "lucide-react";
import { LinkKindIcon } from "@/components/social-icons";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { baseMarketingProfile, destinations } from "./product-profile-fixture";
import { demoIdentity, demoLinks } from "../profile-preview";

type Focus = "identity" | "links" | "contact";

const tabs: { id: Focus; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "links", label: "Links" },
  { id: "contact", label: "Contact" },
];

// What the product has for contact (the profiles spec): a Save contact action carrying the profile's email and phone, and a
// message form.
const contactOptions = [
  { label: "Save contact", hint: "Adds your details to their phone" },
  { label: "Email", hint: "Included when they save your contact" },
  { label: "Phone", hint: "Included when they save your contact" },
  { label: "Contact form", hint: "Lets people send you a message" },
];

// Tabs explore the sample editor; the profile stays complete. Preview actions never navigate or download.
export function ProductMakeItYours() {
  const [focus, setFocus] = useState<Focus>("identity");

  return (
    <section aria-labelledby="make-it-yours-heading" className="pp-section pp-studio-section">
      <div className="pp-container">
        <div className="pp-section-head">
          <h2 id="make-it-yours-heading" className="pp-heading pp-studio-heading">
            <span>Make it yours.</span> <span>Build your profile your way.</span>
          </h2>
          <p className="pp-support">Your identity, links, and contact details, all in one place. See how your profile comes together, just as people will see it.</p>
        </div>

        <div className="pp-studio">
          <div className="pp-studio-editor">
            <div className="pp-studio-head">
              <div className="pp-studio-title"><p>Edit profile</p><span>Make a great first impression.</span></div>
              <span className="pp-studio-saved"><Check size={14} aria-hidden="true" /> Preview example</span>
            </div>
            <div className="pp-studio-tabs" role="group" aria-label="Profile sections">
              {tabs.map(({ id, label }) => (
                <button key={id} type="button" aria-pressed={focus === id} onClick={() => setFocus(id)}>
                  {label}
                </button>
              ))}
            </div>

            <ul className="pp-studio-rows" aria-label={`${focus} settings`}>
              {focus === "identity" ? (
                <>
                  <li className="pp-studio-photo-row">
                    <span className="pp-studio-photo">
                      <Image src={demoIdentity.image!.url} alt="" width={56} height={56} />
                    </span>
                    <span><strong>Profile photo</strong><span className="pp-studio-hint">Put a face to your name.</span></span>
                    <span className="pp-studio-photo-change" aria-hidden="true"><ImagePlus size={16} /><span>Change</span></span>
                  </li>
                  <Row label="Name">{demoIdentity.fullName}</Row>
                  <Row label="Headline">{demoIdentity.headline}</Row>
                  <Row label="Location"><MapPin size={15} aria-hidden="true" />{demoIdentity.location}</Row>
                </>
              ) : focus === "links" ? (
                [...destinations, ...demoLinks.slice(0, 2)].map(({ kind, label }) => (
                  <li key={kind} className="pp-studio-row pp-studio-inline">
                    <LinkKindIcon kind={kind} className="pp-studio-icon" />
                    <span className="pp-studio-link-name">{label}<span className="pp-studio-hint">{kind === "portfolio" ? "Your work, in one place" : kind === "booking" ? "Time to connect" : "Your social profile"}</span></span>
                    <GripVertical aria-hidden="true" size={16} className="pp-studio-aside" />
                  </li>
                ))
              ) : (
                contactOptions.map(({ label, hint }) => (
                  <li key={label} className="pp-studio-row pp-studio-inline">
                    <span>
                      <span className="pp-studio-link-name">{label}</span>
                      <span className="pp-studio-hint">{hint}</span>
                    </span>
                    <span role="img" aria-label="On" className="pp-studio-switch" />
                  </li>
                ))
              )}
            </ul>
            <div className="pp-studio-footer"><span>One profile. All the right details.</span><ArrowUpRight size={16} aria-hidden="true" /></div>
          </div>

          <div className="pp-studio-preview">
            <div className="pp-studio-profile-frame" role="img" aria-label="Sample Neffi Classic profile preview for Mika Santos">
              <div className="pp-studio-profile-scale" inert>
                <ProfileRenderer view={baseMarketingProfile} />
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
      <span className="pp-studio-field-label">{label}</span>
      <span className="pp-studio-value">{children}</span>
    </li>
  );
}
