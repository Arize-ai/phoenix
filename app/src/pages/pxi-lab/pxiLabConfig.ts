export type PxiTreatment = "conic" | "aurora" | "glass";
export type PxiRingState = "idle" | "eligible" | "active";

/**
 * Every knob the lab sidebar exposes. All visual output is a pure function of
 * this config — treatments are CSS-only, so exploring a new direction means
 * adding a palette or a treatment block, not new component logic.
 */
export interface PxiLabConfig {
  treatment: PxiTreatment;
  /** shared treatment gradient stops (rings, borders, glows), hex */
  c1: string;
  c2: string;
  c3: string;
  /** seconds per animation cycle */
  speed: number;
  /** ring/stroke width in px */
  ringWidth: number;
  /** glow intensity 0..1, tuned per theme */
  glowLight: number;
  glowDark: number;
  /** glow blur radius in px, tuned per theme */
  spreadLight: number;
  spreadDark: number;
  /** corner radius of ring decorators in px */
  radius: number;
  /** state applied to the ring decorators in the scenarios */
  ringState: PxiRingState;
  /** false freezes all treatment animation (reduced-motion preview) */
  motion: boolean;
}

export const PXI_TREATMENTS: {
  id: PxiTreatment;
  label: string;
  description: string;
}[] = [
  {
    id: "conic",
    label: "Conic",
    description:
      "Animated conic-gradient border sweep. Maximal 'this is AI' legibility; the Gemini/Copilot direction.",
  },
  {
    id: "aurora",
    label: "Aurora",
    description:
      "Hairline stroke with a soft blurred multi-hue halo. Atmosphere over line; the Apple Intelligence direction.",
  },
  {
    id: "glass",
    label: "Glass",
    description:
      "Iridescent glass: translucent tinted fill, static gradient hairline, inner top light. Sits between Conic and Mono.",
  },
];

export const PXI_PALETTES: {
  id: string;
  label: string;
  c1: string;
  c2: string;
  c3: string;
}[] = [
  // From the FAB glow spectrum (AgentChatWidget box-shadow stacks)
  {
    id: "glow",
    label: "PXI Glow",
    c1: "#9a66ff",
    c2: "#3480ff",
    c3: "#2cd8ff",
  },
  // Magenta-leaning cut of the same spectrum
  { id: "nova", label: "Nova", c1: "#c648ff", c2: "#9a66ff", c3: "#6bd7ff" },
];

export const DEFAULT_PXI_LAB_CONFIG: PxiLabConfig = {
  treatment: "conic",
  c1: PXI_PALETTES[0].c1,
  c2: PXI_PALETTES[0].c2,
  c3: PXI_PALETTES[0].c3,
  speed: 3,
  ringWidth: 1.5,
  glowLight: 0.8,
  glowDark: 0.2,
  spreadLight: 10,
  spreadDark: 8,
  radius: 8,
  ringState: "active",
  motion: true,
};

const isTreatment = (value: unknown): value is PxiTreatment =>
  PXI_TREATMENTS.some((t) => t.id === value);

const isRingState = (value: unknown): value is PxiRingState =>
  value === "idle" || value === "eligible" || value === "active";

const parseHex = (value: string | null, fallback: string) =>
  value && /^[0-9a-fA-F]{6}$/.test(value) ? `#${value}` : fallback;

const parseNumber = (
  value: string | null,
  fallback: number,
  min: number,
  max: number
) => {
  const parsed = value == null ? NaN : Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
};

/**
 * Round-trips the config through URL search params so a tuned direction is a
 * shareable link.
 */
export function parsePxiLabConfig(searchParams: URLSearchParams): PxiLabConfig {
  const defaults = DEFAULT_PXI_LAB_CONFIG;
  const treatment = searchParams.get("t");
  const ringState = searchParams.get("st");
  return {
    treatment: isTreatment(treatment) ? treatment : defaults.treatment,
    c1: parseHex(searchParams.get("c1"), defaults.c1),
    c2: parseHex(searchParams.get("c2"), defaults.c2),
    c3: parseHex(searchParams.get("c3"), defaults.c3),
    speed: parseNumber(searchParams.get("sp"), defaults.speed, 0.5, 12),
    ringWidth: parseNumber(searchParams.get("rw"), defaults.ringWidth, 0.5, 4),
    glowLight: parseNumber(searchParams.get("gll"), defaults.glowLight, 0, 1),
    glowDark: parseNumber(searchParams.get("gld"), defaults.glowDark, 0, 1),
    spreadLight: parseNumber(
      searchParams.get("gsl"),
      defaults.spreadLight,
      2,
      48
    ),
    spreadDark: parseNumber(
      searchParams.get("gsd"),
      defaults.spreadDark,
      2,
      48
    ),
    radius: parseNumber(searchParams.get("rad"), defaults.radius, 0, 24),
    ringState: isRingState(ringState) ? ringState : defaults.ringState,
    motion: searchParams.get("m") !== "0",
  };
}

export function serializePxiLabConfig(config: PxiLabConfig): URLSearchParams {
  return new URLSearchParams({
    t: config.treatment,
    c1: config.c1.replace("#", ""),
    c2: config.c2.replace("#", ""),
    c3: config.c3.replace("#", ""),
    sp: String(config.speed),
    rw: String(config.ringWidth),
    gll: String(config.glowLight),
    gld: String(config.glowDark),
    gsl: String(config.spreadLight),
    gsd: String(config.spreadDark),
    rad: String(config.radius),
    st: config.ringState,
    m: config.motion ? "1" : "0",
  });
}
