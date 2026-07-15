import { css } from "@emotion/react";
import { useId, useState } from "react";

import { DisclosureArrow, Text } from "@phoenix/components";
import {
  SegmentChart,
  useCategoryChartColors,
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

  .chat-token-usage-details__segments {
    display: flex;
    align-items: center;
    justify-content: flex-end;
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
};

export function ChatTokenUsageDetails({
  total,
  prompt,
  completion,
}: ChatTokenUsageDetailsProps) {
  const colors = useCategoryChartColors();
  const segments = [
    { name: "Prompt", value: prompt, color: colors.category1 },
    { name: "Completion", value: completion, color: colors.category2 },
  ];

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
          segments={segments}
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
          {segments.map((segment) => (
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
          />
        </div>
      ) : null}
    </div>
  );
}
