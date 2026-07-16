import { css } from "@emotion/react";
import { useId, useState } from "react";

import { DisclosureArrow, Text } from "@phoenix/components";
import {
  SegmentChart,
  useCategoryChartColors,
  useGrayscaleCategoricalColors,
} from "@phoenix/components/chart";
import { TokenCount } from "@phoenix/components/trace";
import { formatInt, formatIntShort } from "@phoenix/utils/numberFormatUtils";

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
    gap: var(--global-dimension-static-size-25);
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
  gap: var(--global-dimension-static-size-100);
  padding-top: var(--global-dimension-static-size-100);

  .chat-token-usage-details__legend {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-static-size-100);
  }

  .chat-token-usage-details__chart {
    position: relative;
  }

  .chat-token-usage-details__prompt-trigger {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    min-width: 1%;
    border-radius: var(--global-rounding-medium);
    cursor: pointer;
    outline: none;

    &:focus-visible {
      outline: var(--global-border-size-thick) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }

  .chat-token-usage-details__segments {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: var(--global-dimension-static-size-200);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .chat-token-usage-details__segment {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-static-size-50);
  }

  .chat-token-usage-details__swatch {
    width: var(--global-dimension-static-size-100);
    height: var(--global-dimension-static-size-100);
    flex: none;
    border-radius: var(--global-rounding-full);
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

export function ChatTokenUsageDetails({
  total,
  prompt,
  completion,
  promptDetails,
}: ChatTokenUsageDetailsProps) {
  const colors = useCategoryChartColors();
  const grayscaleColors = useGrayscaleCategoricalColors();
  const [isPromptHovered, setIsPromptHovered] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const promptLegendId = useId();
  const cacheRead = getClampedTokenCount({
    value: promptDetails?.cacheRead ?? 0,
    maximum: prompt,
  });
  const cacheWrite = getClampedTokenCount({
    value: promptDetails?.cacheWrite ?? 0,
    maximum: Math.max(prompt - cacheRead, 0),
  });
  const uncachedPrompt = Math.max(prompt - cacheRead - cacheWrite, 0);
  const hasPromptDetails = prompt > 0 && (cacheRead > 0 || cacheWrite > 0);
  const isPromptBreakdownActive =
    hasPromptDetails && (isPromptHovered || isPromptFocused);
  const defaultSegments: TokenSegment[] = [
    { name: "Prompt", value: prompt, color: colors.category1 },
    { name: "Completion", value: completion, color: colors.category2 },
  ];
  const promptSegments: TokenSegment[] = [
    { name: "Uncached", value: uncachedPrompt, color: colors.category1 },
    { name: "Cache read", value: cacheRead, color: colors.category5 },
    { name: "Cache write", value: cacheWrite, color: colors.category4 },
  ];
  const chartSegments = isPromptBreakdownActive
    ? [
        ...promptSegments,
        {
          name: "Completion",
          value: completion,
          color: grayscaleColors.gray3,
        },
      ]
    : defaultSegments;
  const legendSegments = isPromptBreakdownActive
    ? promptSegments.filter((segment) => segment.value > 0)
    : defaultSegments;
  const promptPercentage =
    total > 0 ? Math.min(Math.max((prompt / total) * 100, 0), 100) : 0;

  return (
    <div
      className="chat-token-usage-details"
      css={chatTokenUsageDetailsCSS}
      role="region"
      aria-label="Token usage breakdown"
    >
      <div className="chat-token-usage-details__chart">
        <div aria-hidden="true">
          <SegmentChart
            height={6}
            minimumSegmentPercentage={1}
            totalValue={total}
            segments={chartSegments}
          />
        </div>
        {hasPromptDetails ? (
          <button
            className="chat-token-usage-details__prompt-trigger button--reset"
            type="button"
            style={{ width: `${promptPercentage}%` }}
            aria-controls={promptLegendId}
            aria-expanded={isPromptBreakdownActive}
            aria-label={`${formatInt(prompt)} prompt tokens. Show cache details`}
            onMouseEnter={() => setIsPromptHovered(true)}
            onMouseLeave={() => setIsPromptHovered(false)}
            onFocus={() => setIsPromptFocused(true)}
            onBlur={() => setIsPromptFocused(false)}
          />
        ) : null}
      </div>
      <div
        className="chat-token-usage-details__legend"
        id={promptLegendId}
        aria-live="polite"
      >
        <Text size="XS" color="text-700" weight="heavy">
          {isPromptBreakdownActive ? "Prompt" : "Total"}
        </Text>
        <ul
          className="chat-token-usage-details__segments"
          aria-label="Token types"
        >
          {legendSegments.map((segment) => (
            <li
              className="chat-token-usage-details__segment"
              key={segment.name}
            >
              <span
                className="chat-token-usage-details__swatch"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <Text size="XS" color="text-500" fontFamily="mono">
                {formatIntShort(segment.value)} {segment.name}
              </Text>
            </li>
          ))}
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
