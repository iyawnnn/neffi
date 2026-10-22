import type { CSSProperties } from "react";
import type { SceneView } from "@/modules/profiles/scene-view";
import { profileSections } from "@/modules/profiles/profile-sections";
import { profileTheme } from "@/modules/profiles/profile-theme";
import { ClassicLayout } from "./classic-layout";
import "./profile.css";

export type VisitorActions = { saveContactHref: string };

export function ProfileRenderer({ view, visitorActions }: { view: SceneView; visitorActions?: VisitorActions }) {
  const sections = profileSections(view);
  // Editorial and Showcase use Classic until their implementation milestones.
  switch (view.appearance.layout) {
    case "classic":
    default:
      return (
        <article className="pf-profile" data-layout="classic" data-preview={!visitorActions || undefined}
          style={{ ...profileTheme(view.appearance.accent, view.appearance.mode), colorScheme: view.appearance.mode } as CSSProperties}>
          <ClassicLayout sections={sections} visitorActions={visitorActions} />
        </article>
      );
  }
}
