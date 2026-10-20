import { ArrowRight, Check, Mail, Phone } from "lucide-react";
import { DemoAvatar, demoIdentity } from "./profile-preview";

export function SaveContactScene() {
  return (
    <div className="pe-contact-scene" role="img" aria-label="Illustration of saving Mika Santos from Neffi to your contacts, including name, email and phone">
      <div className="pe-contact-source">
        <DemoAvatar />
        <h3>{demoIdentity.fullName}</h3>
        <p>{demoIdentity.headline}</p>
        <span>{demoIdentity.location}</span>
      </div>
      <ArrowRight className="pe-transfer-cue" size={24} strokeWidth={1.25} aria-hidden="true" />
      <div className="pe-contact-destination">
        <div className="pe-contact-heading"><DemoAvatar /><div><h3>{demoIdentity.fullName}</h3><p>{demoIdentity.headline}</p></div></div>
        <div className="pe-contact-detail"><Mail size={16} aria-hidden="true" /><span>Email</span></div>
        <div className="pe-contact-detail"><Phone size={16} aria-hidden="true" /><span>Mobile</span></div>
        <div className="pe-contact-success"><Check size={16} aria-hidden="true" />Added to contacts</div>
      </div>
    </div>
  );
}
