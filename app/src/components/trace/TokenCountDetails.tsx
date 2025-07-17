import { css } from "@emotion/react";

import { Text } from "@phoenix/components";

const tokenCountDetailsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-static-size-50);
`;

const tokenCountRowCSS = css`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: var(--ac-global-dimension-static-size-100);
`;

const tokenCountValueCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--ac-global-dimension-static-size-25);
`;

const sectionHeaderCSS = css`
  margin-top: var(--ac-global-dimension-static-size-100);
  margin-bottom: var(--ac-global-dimension-static-size-25);
`;

interface TokenCountRowProps {
  label: string;
  count: number | null | undefined;
  isTotal?: boolean;
  isSubItem?: boolean;
}

function TokenCountRow({
  label,
  count,
  isTotal = false,
  isSubItem = false,
}: TokenCountRowProps) {
  const displayCount = typeof count === "number" ? count : "--";

  return (
    <div css={tokenCountRowCSS}>
      <Text
        size={isSubItem ? "XS" : "S"}
        color={isSubItem ? "text-500" : isTotal ? "text-900" : "text-700"}
        weight={isTotal ? "heavy" : "normal"}
      >
        {label}
      </Text>
      <div css={tokenCountValueCSS}>
        <Text size={isSubItem ? "XS" : "S"} color="text-700">
          {displayCount}t
        </Text>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <Text size="XS" color="text-700" weight="heavy" css={sectionHeaderCSS}>
      {children}
    </Text>
  );
}

export interface TokenCountDetailsProps {
  /**
   * Total token count
   */
  total?: number | null;
  /**
   * Prompt token count
   */
  prompt?: number | null;
  /**
   * Completion token count
   */
  completion?: number | null;
  /**
   * Additional prompt token details as key-value pairs
   */
  promptDetails?: Record<string, number | null | undefined>;
  /**
   * Additional completion token details as key-value pairs
   */
  completionDetails?: Record<string, number | null | undefined>;
}

export function TokenCountDetails({
  total,
  prompt,
  completion,
  promptDetails,
  completionDetails,
}: TokenCountDetailsProps) {
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
    <div css={tokenCountDetailsCSS}>
      {/* Main three rows */}
      {total != null && (
        <TokenCountRow label="Total" count={total} isTotal={true} />
      )}

      {prompt != null && <TokenCountRow label="Prompt" count={prompt} />}

      {completion != null && (
        <TokenCountRow label="Completion" count={completion} />
      )}

      {/* Prompt details sub-section */}
      {hasPromptDetails && (
        <>
          <SectionHeader>Prompt Details</SectionHeader>
          {promptDetails &&
            Object.entries(promptDetails).map(([key, value]) => {
              if (value != null && value > 0) {
                return (
                  <TokenCountRow
                    key={`prompt-${key}`}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    count={value}
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
                  <TokenCountRow
                    key={`completion-${key}`}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    count={value}
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
