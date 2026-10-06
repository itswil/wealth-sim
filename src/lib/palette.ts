// Okabe-Ito colorblind-safe data colors, plus the two accent shades the
// charts borrow from Tailwind's slate/sky ramps.
export const PALETTE = {
  vermillion: "#D55E00",
  blue: "#0072B2",
  green: "#009E73",
  slate: "#64748B",
  sky: "#0284C7",
  burntOrange: "#C2410C",
} as const;

/**
 * The Okabe-Ito hues above are chosen for strokes and fills, which only need
 * 3:1 against their backdrop — and they clear that bar. The charts' direct
 * labels are *text* at 10–12px, so they need 4.5:1, which the raw hues miss on
 * white (vermillion 3.9:1, green 3.4:1) and on the dark card (blue 2.8:1,
 * slate 3.1:1). These are the same four hues nudged until they clear AA on
 * both card backgrounds; the line and bar fills keep the canonical values.
 */
export const LABEL_COLOR = {
  vermillion: { light: "#B85000", dark: "#E07A45" },
  blue: { light: "#0072B2", dark: "#4DA3D9" },
  slate: { light: "#64748B", dark: "#94A3B8" },
  green: { light: "#008060", dark: "#2FBF8E" },
} as const;

export type LabelColorName = keyof typeof LABEL_COLOR;

/** Text fill for a label colour, resolved for the active theme. */
export const labelColor = (name: LabelColorName, dark: boolean): string =>
  LABEL_COLOR[name][dark ? "dark" : "light"];
