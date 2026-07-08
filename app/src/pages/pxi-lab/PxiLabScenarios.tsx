import { Flex } from "@phoenix/components";

import type { PxiRingState } from "./pxiLabConfig";
import { PXI_SCENARIOS } from "./scenarios";
import { LabSection } from "./scenarios/LabSection";

/**
 * Renders every registered scenario against the shared host surfaces. Each
 * example is a self-contained module under `scenarios/` — add or edit one
 * without touching this file. See `scenarios/index.ts` for the registry.
 */
export function PxiLabScenarios({ ringState }: { ringState: PxiRingState }) {
  return (
    <Flex direction="column" gap="size-400">
      {PXI_SCENARIOS.map(({ title, Component }) => (
        <LabSection key={title} title={title}>
          <Component ringState={ringState} />
        </LabSection>
      ))}
    </Flex>
  );
}
