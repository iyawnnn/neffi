import type { CSSProperties } from "react";
import type { SceneView } from "@/modules/profiles/scene-view";
import { profileSections } from "@/modules/profiles/profile-sections";
import { profileTheme } from "@/modules/profiles/profile-theme";
import { ClassicLayout } from "./classic-layout";
import { EditorialLayout } from "./editorial-layout";
import "./profile.css";

export type VisitorActions = { saveContactHref: string };

export function ProfileRenderer({ view, visitorActions }: { view: SceneView; visitorActions?: VisitorActions }) {
  const sections = profileSections(view);
  // Showcase keeps the Classic fallback until its implementation milestone.
  const editorial = view.appearance.layout === "editorial";
  const Layout = editorial ? EditorialLayout : ClassicLayout;
  return (
    <article className="pf-profile" data-layout={editorial ? "editorial" : "classic"} data-preview={!visitorActions || undefined}
      style={{ ...profileTheme(view.appearance.accent, view.appearance.mode), colorScheme: view.appearance.mode } as CSSProperties}>
      <Layout sections={sections} visitorActions={visitorActions} />
    </article>
  );
}
