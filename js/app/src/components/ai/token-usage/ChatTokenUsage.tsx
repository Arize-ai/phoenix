import { css } from "@emotion/react";
import { useId, useState } from "react";

import { useCategoryChartColors } from "@phoenix/components/chart/colors";
import { SegmentChart } from "@phoenix/components/chart/SegmentChart";
import { Button } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import { DisclosureArrow } from "@phoenix/components/core/icon";
import { RichTooltip, TooltipTrigger } from "@phoenix/components/core/tooltip";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { formatInt, formatIntShort } from "@phoenix/utils/numberFormatUtils";
import {
  compareTokenTypes,
  getTokenDetailColor,
  getTokenDetailLabel,
  getTokenDetailValuesWithRemainder,
  getTokenKindLabel,
} from "@phoenix/utils/tokenDetailUtils";

const chatTokenUsageCSS = css`
  display: contents;

  .chat-token-usage__summary {
    display: flex;
    justify-content: flex-end;
    grid-column: 2;
    grid-row: 1;
  }

  .chat-token-usage__trigger {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-25);
    border-radius: var(--global-rounding-small);
    color: var(--global-text-color-300);
    cursor: pointer;
    outline: none;
    transition: color 150ms ease-in-out;

    .token-count-item .icon-wrap,
    .token-count-item .text,
    .disclosure-arrow {
      color: currentColor;
    }

    &:hover,
    &:focus-visible,
    &[aria-expanded="true"] {
      color: var(--global-text-color-700);
    }

    &:focus-visible {
      outline: var(--global-border-size-thick) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }

  .chat-token-usage__details {
    grid-column: 1 / -1;
    grid-row: 2;
    min-width: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-token-usage__trigger {
      transition: none;
    }
  }
`;

const chatTokenUsageDetailsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding-top: var(--global-dimension-size-100);

  .chat-token-usage-details__legend {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
  }

  .chat-token-usage-details__segments {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-200);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .chat-token-usage-details__segment {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }
`;

const promptLegendTriggerCSS = css`
  & {
    all: unset;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    border-radius: var(--global-rounding-small);
    cursor: help;
  }

  &[data-size="S"] {
    height: auto;
    padding: 0;
  }

  &[data-variant="quiet"],
  &[data-variant="quiet"]:hover:not([disabled]) {
    border-color: transparent;
    background-color: transparent;
  }

  .chat-token-usage-details__segment-text {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }

  &:focus-visible {
    outline: var(--global-border-size-thick) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

const tokenSegmentSwatchCSS = css`
  width: var(--global-dimension-size-100);
  height: var(--global-dimension-size-100);
  flex: none;
  border-radius: var(--global-rounding-full);
`;

const promptDetailsTooltipCSS = css`
  .chat-token-usage-details__tooltip-title {
    margin-bottom: var(--global-dimension-size-100);
  }

  .chat-token-usage-details__tooltip-segments {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .chat-token-usage-details__tooltip-segment {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }
`;

export type ChatTokenUsageDetailsProps = {
  total: number;
  prompt: number;
  completion: number;
  promptDetails?: {
    cacheRead: number;
    cacheWrite: number;
  };
};

type TokenSegment = {
  name: string;
  value: number;
  color: string;
};

function getClampedTokenCount({
  value,
  maximum,
}: {
  value: number;
  maximum: number;
}) {
  return Math.min(Math.max(value, 0), Math.max(maximum, 0));
}

function TokenSegmentContent({ segment }: { segment: TokenSegment }) {
  return (
    <>
      <span
        className="chat-token-usage-details__swatch"
        css={tokenSegmentSwatchCSS}
        style={{ backgroundColor: segment.color }}
        aria-hidden="true"
      />
      <Text
        className="chat-token-usage-details__segment-text"
        size="XS"
        color="text-500"
        fontFamily="mono"
      >
        {formatIntShort(segment.value)} {segment.name}
      </Text>
    </>
  );
}

function PromptTokenLegendItem({
  promptSegment,
  promptDetailsSegments,
}: {
  promptSegment: TokenSegment;
  promptDetailsSegments: TokenSegment[];
}) {
  const promptLabel = getTokenKindLabel({ isPrompt: true });
  return (
    <li className="chat-token-usage-details__segment">
      <TooltipTrigger delay={0} closeDelay={0}>
        <Button
          className="chat-token-usage-details__segment-trigger"
          css={promptLegendTriggerCSS}
          size="S"
          variant="quiet"
          aria-label={`${formatInt(promptSegment.value)} ${promptLabel.toLowerCase()} tokens. Show cache details`}
        >
          <TokenSegmentContent segment={promptSegment} />
        </Button>
        <RichTooltip css={promptDetailsTooltipCSS} placement="top" offset={3}>
          <Text
            className="chat-token-usage-details__tooltip-title"
            size="XS"
            color="text-700"
            weight="heavy"
          >
            {promptLabel} details
          </Text>
          <ul
            className="chat-token-usage-details__tooltip-segments"
            aria-label={`${promptLabel} token types`}
          >
            {promptDetailsSegments.map((segment) => (
              <li
                className="chat-token-usage-details__tooltip-segment"
                key={segment.name}
              >
                <TokenSegmentContent segment={segment} />
              </li>
            ))}
          </ul>
        </RichTooltip>
      </TooltipTrigger>
    </li>
  );
}

export function ChatTokenUsageDetails({
  total,
  prompt,
  completion,
  promptDetails,
}: ChatTokenUsageDetailsProps) {
  const colors = useCategoryChartColors();
  const cacheRead = getClampedTokenCount({
    value: promptDetails?.cacheRead ?? 0,
    maximum: prompt,
  });
  const cacheWrite = getClampedTokenCount({
    value: promptDetails?.cacheWrite ?? 0,
    maximum: Math.max(prompt - cacheRead, 0),
  });
  const hasPromptDetails = prompt > 0 && (cacheRead > 0 || cacheWrite > 0);
  const promptSegment: TokenSegment = {
    name: getTokenKindLabel({ isPrompt: true }),
    value: prompt,
    color: colors.category1,
  };
  const completionSegment: TokenSegment = {
    name: getTokenKindLabel({ isPrompt: false }),
    value: completion,
    color: colors.category2,
  };
  // Named and colored by token type, so the cache reads here read and look
  // like the cache reads in the metrics charts and the cost tooltips. What
  // the cache did not cover is attributed to plain input the same way.
  const promptSegments: TokenSegment[] = Object.entries(
    getTokenDetailValuesWithRemainder({
      details: { cache_read: cacheRead, cache_write: cacheWrite },
      sideTotal: prompt,
      isPrompt: true,
    })
  )
    .sort(([left], [right]) => compareTokenTypes(left, right))
    .map(([tokenType, value]) => ({
      name: getTokenDetailLabel(tokenType),
      value,
      color: getTokenDetailColor({ colors, tokenType }),
    }));

  return (
    <div
      className="chat-token-usage-details"
      css={chatTokenUsageDetailsCSS}
      role="region"
      aria-label="Token usage breakdown"
    >
      <div aria-hidden="true">
        <SegmentChart
          height={6}
          minimumSegmentPercentage={1}
          totalValue={total}
          segments={[promptSegment, completionSegment]}
        />
      </div>
      <div className="chat-token-usage-details__legend">
        <Text size="XS" color="text-700" weight="heavy">
          Total
        </Text>
        <ul
          className="chat-token-usage-details__segments"
          aria-label="Token types"
        >
          {hasPromptDetails ? (
            <PromptTokenLegendItem
              promptSegment={promptSegment}
              promptDetailsSegments={promptSegments}
            />
          ) : (
            <li className="chat-token-usage-details__segment">
              <TokenSegmentContent segment={promptSegment} />
            </li>
          )}
          <li className="chat-token-usage-details__segment">
            <TokenSegmentContent segment={completionSegment} />
          </li>
        </ul>
      </div>
    </div>
  );
}

export function ChatTokenUsage({
  total,
  prompt,
  completion,
  promptDetails,
}: ChatTokenUsageDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();

  return (
    <div
      className="chat-token-usage"
      css={chatTokenUsageCSS}
      data-expanded={isExpanded}
    >
      <div className="chat-token-usage__summary">
        <button
          className="chat-token-usage__trigger button--reset"
          type="button"
          aria-controls={detailsId}
          aria-expanded={isExpanded}
          aria-label={`${formatInt(total)} total tokens`}
          onClick={() => setIsExpanded((wasExpanded) => !wasExpanded)}
        >
          <TokenCount size="S" color="text-300">
            {total}
          </TokenCount>
          <DisclosureArrow isExpanded={isExpanded} />
        </button>
      </div>
      {isExpanded ? (
        <div className="chat-token-usage__details" id={detailsId}>
          <ChatTokenUsageDetails
            total={total}
            prompt={prompt}
            completion={completion}
            promptDetails={promptDetails}
          />
        </div>
      ) : null}
    </div>
  );
}
