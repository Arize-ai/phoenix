// --- registry -------------------------------------------------------------
// To add an example: create a sibling file that default-exports a PxiScenario,
// import it here, and append it to the array. Editing an existing example
// touches only its own file — no collisions.
import actionCluster from "./ActionCluster";
import fabReference from "./FabReference";
import hoverReveal from "./HoverReveal";
import menuItem from "./MenuItem";
import ringDropdown from "./RingDropdown";
import ringPanel from "./RingPanel";
import triggers from "./Triggers";
import type { PxiScenario } from "./types";

export const PXI_SCENARIOS: PxiScenario[] = [
  fabReference,
  triggers,
  actionCluster,
  hoverReveal,
  ringDropdown,
  ringPanel,
  menuItem,
];

export type { PxiScenario, PxiScenarioProps } from "./types";
