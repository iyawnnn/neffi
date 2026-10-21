import { ACCENTS, type ColorMode } from "./appearance-options";
import { onAccent } from "./color-contrast";

const INK = ACCENTS[0];

export function profileTheme(accentHex: string | null, mode: ColorMode) {
  const accent = ACCENTS.find((option) => option.hex === accentHex) ?? INK;
  const dark = mode === "dark";
  const accentValue = dark ? accent.dark : accent.hex;
  return {
    "--pf-bg": dark ? "#0C0C0D" : "#F7F8FA",
    "--pf-surface": dark ? "#18191C" : "#FFFFFF",
    "--pf-fg": dark ? "#F7F8FA" : "#0C0C0D",
    "--pf-fg-muted": dark ? "#B9BBC2" : "#62646A",
    "--pf-border": dark ? "#303238" : "oklch(0.922 0 0)",
    "--pf-accent": accentValue,
    "--pf-on-accent": onAccent(accentValue),
    "--pf-accent-text": dark ? accent.dark : accent.text,
  };
}
