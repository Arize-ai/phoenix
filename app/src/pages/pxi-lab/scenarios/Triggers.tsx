import { Flex, Tooltip, TooltipTrigger } from "@phoenix/components";

import { SolveWithPxiButton } from "../SolveWithPxi";
import type { PxiScenario } from "./types";

const scenario: PxiScenario = {
  title: "Triggers — primary, secondary & quiet",
  Component: function Triggers() {
    return (
      <Flex direction="row" gap="size-200" alignItems="center" wrap>
        <SolveWithPxiButton size="M" />
        <SolveWithPxiButton size="S" />
        <SolveWithPxiButton variant="secondary" size="M" />
        <SolveWithPxiButton variant="secondary" size="S" />
        <TooltipTrigger>
          <SolveWithPxiButton variant="quiet" size="M" />
          <Tooltip>Solve with PXI</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <SolveWithPxiButton variant="quiet" size="S" />
          <Tooltip>Solve with PXI</Tooltip>
        </TooltipTrigger>
      </Flex>
    );
  },
};

export default scenario;
