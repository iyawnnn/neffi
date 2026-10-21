import { expect, test } from "vitest";
import { ACCENTS, type ColorMode } from "./appearance-options";
import { contrast } from "./color-contrast";
import { profileTheme } from "./profile-theme";

test.each(["light", "dark"] as const)("owner-selected %s produces deterministic Ink tokens", (mode) => {
  const dark = mode === "dark";
  expect(profileTheme("#0C0C0D", mode)).toEqual({
    "--pf-bg": dark ? "#0C0C0D" : "#F7F8FA", "--pf-surface": dark ? "#18191C" : "#FFFFFF",
    "--pf-fg": dark ? "#F7F8FA" : "#0C0C0D", "--pf-fg-muted": dark ? "#B9BBC2" : "#62646A",
    "--pf-border": dark ? "#303238" : "oklch(0.922 0 0)", "--pf-accent": dark ? "#F7F8FA" : "#0C0C0D",
    "--pf-on-accent": dark ? "#0C0C0D" : "#FFFFFF", "--pf-accent-text": dark ? "#F7F8FA" : "#0C0C0D",
  });
});

test.each(ACCENTS.flatMap((accent) => (["light", "dark"] as const).map((mode) => ({ accent, mode }))))(
  "$accent.name $mode meets the contrast requirements",
  ({ accent, mode }) => {
    const theme = profileTheme(accent.hex, mode);
    expect(theme["--pf-accent"]).toBe(mode === "light" ? accent.hex : accent.dark);
    expect(contrast(theme["--pf-on-accent"], theme["--pf-accent"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme["--pf-accent-text"], theme["--pf-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme["--pf-fg-muted"], theme["--pf-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme["--pf-fg"], theme["--pf-surface"])).toBeGreaterThanOrEqual(4.5);
  },
);

test("NULL and off-palette accents resolve to Ink", () => {
  for (const accent of [null, "#2f6fed", "#FFFFFF", "", "unexpected", "#12", "var(--brand)"]) {
    for (const mode of ["light", "dark"] satisfies ColorMode[]) {
      expect(profileTheme(accent, mode)).toEqual(profileTheme("#0C0C0D", mode));
    }
  }
});
