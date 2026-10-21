// Neffi-maintained accent swatches (Brand Identity: customer profiles keep their own colours).
export const LAYOUTS = ["classic", "editorial", "showcase"] as const;
export type Layout = (typeof LAYOUTS)[number];
export const COLOR_MODES = ["light", "dark"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const ACCENTS = [
  { name: "Ink", hex: "#0C0C0D" },
  { name: "Ocean", hex: "#1F5FAE" },
  { name: "Teal", hex: "#0E7C86" },
  { name: "Forest", hex: "#2E6B4F" },
  { name: "Amber", hex: "#B86E00" },
  { name: "Vermilion", hex: "#E64A35" },
  { name: "Rose", hex: "#B83A6B" },
  { name: "Plum", hex: "#6B3FA0" },
] as const;
