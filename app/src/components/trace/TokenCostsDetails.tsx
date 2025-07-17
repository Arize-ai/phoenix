import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

const tokenCostsDetailsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-static-size-100);
  min-width: 200px;
`;

const tokenCostRowCSS = css`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: var(--ac-global-dimension-static-size-200);

  &[data-is-total="true"] {
    font-weight: var(--ac-global-font-weight-heavy);
  }

  &[data-is-sub-item="true"] {
    margin-left: var(--ac-global-dimension-static-size-200);
    color: var(--ac-global-text-color-500);
    font-size: var(--ac-global-font-size-xs);
  }
`;

const sectionHeaderCSS = css`
  font-weight: var(--ac-global-font-weight-heavy);
  font-size: var(--ac-global-font-size-xs);
  color: var(--ac-global-text-color-700);
  margin-top: var(--ac-global-dimension-static-size-100);
`;

interface TokenCostRowProps {
  label: string;
  cost: number;
  isTotal?: boolean;
  isSubItem?: boolean;
}

function TokenCostRow({ label, cost, isTotal, isSubItem }: TokenCostRowProps) {
  return (
    <div
      css={tokenCostRowCSS}
      data-is-total={isTotal}
      data-is-sub-item={isSubItem}
    >
      <Text
        size={isSubItem ? "XS" : "S"}
        weight={isTotal ? "heavy" : "normal"}
        color={isSubItem ? "text-500" : isTotal ? "text-900" : "text-700"}
      >
        {label}
      </Text>
      <Text
        size={isSubItem ? "XS" : "S"}
        color={isSubItem ? "text-500" : "text-700"}
      >
        {costFormatter(cost)}
      </Text>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div css={sectionHeaderCSS}>
      <Text size="XS" weight="heavy" color="text-700">
        {children}
      </Text>
    </div>
  );
}

export interface TokenCostsDetailsProps {
  total?: number | null;
  prompt?: number | null;
  completion?: number | null;
  promptDetails?: Record<string, number | null> | null;
  completionDetails?: Record<string, number | null> | null;
}

export function TokenCostsDetails({
  total,
  prompt,
  completion,
  promptDetails,
  completionDetails,
}: TokenCostsDetailsProps) {
  const hasPromptDetails =
    promptDetails &&
    Object.entries(promptDetails).some(
      ([, value]) => value != null && value > 0
    );
  const hasCompletionDetails =
    completionDetails &&
    Object.entries(completionDetails).some(
      ([, value]) => value != null && value > 0
    );
  return (
    <div css={tokenCostsDetailsCSS}>
      {/* Main three rows */}
      {total != null && (
        <TokenCostRow label="Total" cost={total} isTotal={true} />
      )}

      {prompt != null && <TokenCostRow label="Prompt" cost={prompt} />}

      {completion != null && (
        <TokenCostRow label="Completion" cost={completion} />
      )}

      {/* Prompt details sub-section */}
      {hasPromptDetails && (
        <>
          <SectionHeader>Prompt Details</SectionHeader>
          {promptDetails &&
            Object.entries(promptDetails).map(([key, value]) => {
              if (value != null && value > 0) {
                return (
                  <TokenCostRow
                    key={`prompt-${key}`}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    cost={value}
                    isSubItem={true}
                  />
                );
              }
              return null;
            })}
        </>
      )}

      {/* Completion details sub-section */}
      {hasCompletionDetails && (
        <>
          <SectionHeader>Completion Details</SectionHeader>
          {completionDetails &&
            Object.entries(completionDetails).map(([key, value]) => {
              if (value != null && value > 0) {
                return (
                  <TokenCostRow
                    key={`completion-${key}`}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    cost={value}
                    isSubItem={true}
                  />
                );
              }
              return null;
            })}
        </>
      )}
    </div>
  );
}
