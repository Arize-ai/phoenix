import type { ComponentType } from "react";

import type { PxiRingState } from "../pxiLabConfig";

export interface PxiScenarioProps {
  /** current ring state from the sidebar; ignore if the scenario has no ring */
  ringState: PxiRingState;
}

/**
 * A self-contained lab example. Each scenario lives in its own file under
 * `scenarios/` and is registered once in `scenarios/index.ts`, so adding or
 * editing one example never collides with another.
 */
export interface PxiScenario {
  title: string;
  Component: ComponentType<PxiScenarioProps>;
}
