import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Button,
  Card,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { AgentChatWidgetButton } from "@phoenix/components/agent/AgentChatWidget";
import { PxiGlyph } from "@phoenix/components/agent/PxiGlyph";

import type { PxiRingState } from "./pxiLabConfig";
import {
  PxiHoverReveal,
  PxiRing,
  PxiTag,
  SolveWithPxiButton,
} from "./SolveWithPxi";

const sectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-static-size-100);
`;

const sectionTitleCSS = css`
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

function LabSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section css={sectionCSS}>
      <Text size="XS" color="text-300" css={sectionTitleCSS}>
        {title}
      </Text>
      {children}
    </section>
  );
}

const fieldRowCSS = css`
  justify-content: space-between;
  padding: var(--global-dimension-static-size-100)
    var(--global-dimension-static-size-150);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default, var(--global-color-gray-300));
  &:first-of-type {
    border-top: var(--global-border-size-thin) solid
      var(--global-border-color-default, var(--global-color-gray-300));
  }
`;

/**
 * Realistic host surfaces for the affordance family, modeled on the span
 * detail header, disclosure field rows, and experiment compare cells.
 */
export function PxiLabScenarios({ ringState }: { ringState: PxiRingState }) {
  return (
    <Flex direction="column" gap="size-400">
      <LabSection title="PXI FAB — reference (resting · thinking)">
        <Flex direction="row" gap="size-400" alignItems="center">
          <AgentChatWidgetButton isStreaming={false} />
          <AgentChatWidgetButton isStreaming />
        </Flex>
      </LabSection>

      <LabSection title="Triggers — primary, secondary & quiet">
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
      </LabSection>

      <LabSection title="Action cluster — span header">
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
      </LabSection>

      <LabSection title="Hover reveal — field rows (hover or tab to reveal)">
        <div>
          <PxiHoverReveal
            css={fieldRowCSS}
            reveal={
              <SolveWithPxiButton
                variant="quiet"
                size="S"
                label="Explain with PXI"
              />
            }
          >
            <Flex direction="column" gap="size-25">
              <Text size="XS" color="text-500">
                Output
              </Text>
              <Text size="S">The capital of France is Berlin.</Text>
            </Flex>
          </PxiHoverReveal>
          <PxiHoverReveal
            css={fieldRowCSS}
            reveal={
              <SolveWithPxiButton
                variant="quiet"
                size="S"
                label="Explain with PXI"
              />
            }
          >
            <Flex direction="column" gap="size-25">
              <Text size="XS" color="text-500">
                Exception
              </Text>
              <Text size="S">RateLimitError: 429 Too Many Requests</Text>
            </Flex>
          </PxiHoverReveal>
        </div>
      </LabSection>

      <LabSection title="Ring — dropdown trigger">
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
      </LabSection>

      <LabSection title="Ring — panel section">
        <PxiRing state={ringState}>
          <Card
            title="Output"
            extra={
              <CopyToClipboardButton
                size="S"
                text="output"
                tooltipText="Copy output"
              />
            }
          >
            <View padding="size-200">
              <Flex direction="column" gap="size-100">
                <Text size="S">
                  The retrieval step returned three documents, but the final
                  answer cites a source that is not among them — a likely
                  hallucination introduced during synthesis.
                </Text>
                <Flex direction="row" gap="size-75" alignItems="center">
                  <Text size="XS" color="text-500">
                    Root cause analysis by
                  </Text>
                  <PxiTag />
                </Flex>
              </Flex>
            </View>
          </Card>
        </PxiRing>
      </LabSection>

      <LabSection title="Menu item">
        <View
          borderColor="default"
          borderWidth="thin"
          borderRadius="medium"
          width="size-3000"
        >
          <ListBox aria-label="Span actions" selectionMode="none">
            <ListBoxItem textValue="View trace">
              <Flex direction="row" gap="size-75" alignItems="center">
                <Icon svg={<Icons.List />} />
                <Text>View trace</Text>
              </Flex>
            </ListBoxItem>
            <ListBoxItem textValue="Copy span ID">
              <Flex direction="row" gap="size-75" alignItems="center">
                <Icon svg={<Icons.Duplicate />} />
                <Text>Copy span ID</Text>
              </Flex>
            </ListBoxItem>
            <ListBoxItem textValue="Solve with PXI" className="pxi-menu-item">
              <Flex direction="row" gap="size-75" alignItems="center">
                <span className="pxi-menu-item__glyph" aria-hidden="true">
                  <PxiGlyph size={12} />
                </span>
                <Text>Solve with PXI</Text>
              </Flex>
            </ListBoxItem>
          </ListBox>
        </View>
      </LabSection>
    </Flex>
  );
}
