// Neffi-maintained accent swatches (Brand Identity: customer profiles keep their own colours).
export const LAYOUTS = ["classic", "editorial", "showcase"] as const;
export type Layout = (typeof LAYOUTS)[number];
export const COLOR_MODES = ["light", "dark"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const ACCENTS = [
  { name: "Ink", hex: "#0C0C0D", dark: "#F7F8FA", text: "#0C0C0D" },
  { name: "Ocean", hex: "#1F5FAE", dark: "#8AB4DE", text: "#1F5FAE" },
  { name: "Teal", hex: "#0E7C86", dark: "#76BDB8", text: "#0E7C86" },
  { name: "Forest", hex: "#2E6B4F", dark: "#91BD9E", text: "#2E6B4F" },
  { name: "Amber", hex: "#B86E00", dark: "#DDB978", text: "#8A5200" },
  { name: "Vermilion", hex: "#E64A35", dark: "#EF9D8B", text: "#B53625" },
  { name: "Rose", hex: "#B83A6B", dark: "#D9A0B5", text: "#B83A6B" },
  { name: "Plum", hex: "#6B3FA0", dark: "#BBA5D6", text: "#6B3FA0" },
] as const;
