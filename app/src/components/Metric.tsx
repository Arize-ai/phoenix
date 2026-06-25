import { css } from "@emotion/react";
import type { HTMLAttributes, ReactNode, Ref } from "react";

import { Icon, Icons, Text } from "@phoenix/components";
import { getTextColor } from "@phoenix/components/core/content/textUtils";

/**
 * Compact icon + count used in the tree view rows. Each kind shows its icon
 * followed by a value; `cost` is the exception — the `$` glyph stands in for
 * the icon. Text is XS / text-500 and the icon is tinted to match.
 */
export type MetricKind =
  | "token"
  | "latency"
  | "cost"
  | "feedback"
  | "note"
  | "tool"
  | "llm";

// feedback + note have no dedicated glyph yet, so both borrow Stop.
const METRIC_ICON: Record<Exclude<MetricKind, "cost">, ReactNode> = {
  token: <Icons.Tokens />,
  latency: <Icons.Clock />,
  feedback: <Icons.Stop />,
  note: <Icons.Stop />,
  tool: <Icons.Wrench />,
  llm: <Icons.LLMOutput />,
};

const metricCSS = css`
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-static-size-50);
`;

interface MetricProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  kind: MetricKind;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function Metric({ kind, children, ref, ...props }: MetricProps) {
  const color = "text-500" as const;
  return (
    <div className="metric" css={metricCSS} ref={ref} {...props}>
      {kind === "cost" ? (
        // ponytail: the $ is the icon; render it as XS text in the icon slot
        <Text size="XS" color={color}>
          $
        </Text>
      ) : (
        <Icon
          svg={METRIC_ICON[kind]}
          css={css`
            color: ${getTextColor(color)};
          `}
        />
      )}
      <Text size="XS" color={color} fontFamily="mono">
        {children}
      </Text>
    </div>
  );
}
