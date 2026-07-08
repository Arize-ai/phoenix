import { css } from "@emotion/react";

import {
  Button,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";

import { PxiRing } from "../SolveWithPxi";
import type { PxiScenario, PxiScenarioProps } from "./types";

const scenario: PxiScenario = {
  title: "Ring — dropdown trigger",
  Component: function RingDropdown({ ringState }: PxiScenarioProps) {
    return (
      <PxiRing state={ringState} css={css({ width: "fit-content" })}>
        <Select
          size="S"
          aria-label="Evaluator"
          defaultSelectedKey="hallucination"
        >
          <Button>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>
            <ListBox>
              <SelectItem id="hallucination" textValue="Hallucination">
                Hallucination
              </SelectItem>
              <SelectItem id="relevance" textValue="Relevance">
                Relevance
              </SelectItem>
              <SelectItem id="toxicity" textValue="Toxicity">
                Toxicity
              </SelectItem>
            </ListBox>
          </Popover>
        </Select>
      </PxiRing>
    );
  },
};

export default scenario;
