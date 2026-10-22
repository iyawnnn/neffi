const channel = (value: number) => {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const [red, green, blue] = [1, 3, 5].map((index) => channel(parseInt(hex.slice(index, index + 2), 16)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const contrast = (first: string, second: string) => {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
};

// White unless Ink reads better (Vermilion, Amber), per the design system's "Ink on Vermilion".
export const onAccent = (accent: string) => (contrast(accent, "#FFFFFF") >= contrast(accent, "#0C0C0D") ? "#FFFFFF" : "#0C0C0D");
