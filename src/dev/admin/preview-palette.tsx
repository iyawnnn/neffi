"use client";

import { CommandPalette } from "@/app/admin/command-palette";
import { PREVIEW_BASE, previewHitHref, searchFixtures } from "./fixtures";

function useFixtureSearch(term: string) {
  return { loading: false, failed: false, done: term.length >= 2, hits: searchFixtures(term).slice(0, 20) };
}

export function PreviewPalette() {
  return <CommandPalette useSearch={useFixtureSearch} basePath={PREVIEW_BASE} recordHref={previewHitHref} mutationsEnabled={false} />;
}
