import { NeffiLogo } from "@/components/neffi-logo";
import "./profile-intro.css";

export const PROFILE_INTRO_FLAG = "neffi:profile-intro-seen:v1";

// Runs during HTML parse, right after the overlay and before it paints: a repeat view in this tab marks the overlay so CSS hides it.
// Storage failure fails open to "seen" so a blocked store never covers the Profile.
const gate = `var o=document.currentScript.previousElementSibling;try{if(sessionStorage.getItem(${JSON.stringify(PROFILE_INTRO_FLAG)}))o.setAttribute("data-seen","")
else sessionStorage.setItem(${JSON.stringify(PROFILE_INTRO_FLAG)},"true")}catch(e){o.setAttribute("data-seen","")}`;

// Server-rendered and animated by CSS alone: it needs no hydration, so it can never appear after the Profile is already usable.
export function ProfileIntro() {
  return (
    <>
      <div data-profile-intro suppressHydrationWarning aria-hidden="true" className="neffi-profile-intro pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-canvas text-foreground">
        <NeffiLogo className="h-auto w-28" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: gate }} />
    </>
  );
}
