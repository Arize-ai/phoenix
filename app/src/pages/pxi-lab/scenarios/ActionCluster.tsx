import {
  Button,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

import { SolveWithPxiButton } from "../SolveWithPxi";
import type { PxiScenario } from "./types";

const scenario: PxiScenario = {
  title: "Action cluster — span header",
  Component: function ActionCluster() {
    return (
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap="size-200"
      >
        <Flex direction="column" gap="size-25">
          <Text>ChatCompletion</Text>
          <Text size="XS" color="text-500">
            LLM · 4.2s · 1,204 tokens · error
          </Text>
        </Flex>
        <Flex direction="row" alignItems="center" gap="size-100" flex="none">
          <Button size="S" leadingVisual={<Icon svg={<Icons.Edit />} />}>
            Annotate
          </Button>
          <CopyToClipboardButton
            size="S"
            text="span-8f2ac1"
            tooltipText="Copy Span ID"
          />
          <TooltipTrigger>
            <SolveWithPxiButton variant="secondary" size="S" iconOnly />
            <Tooltip>Solve with PXI</Tooltip>
          </TooltipTrigger>
        </Flex>
      </Flex>
    );
  },
};

export default scenario;
