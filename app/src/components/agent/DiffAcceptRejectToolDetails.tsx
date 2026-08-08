import { css } from "@emotion/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { type ReactNode, useMemo } from "react";

import { Flex } from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";

import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

const diffAcceptRejectToolDetailsCSS = css`
  .diff-accept-reject__header {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-250)
      var(--global-dimension-size-50);
  }

  .diff-accept-reject__header-icon {
    flex-shrink: 0;
  }

  .diff-accept-reject__header-label {
    min-width: 0;
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .diff-accept-reject__diff {
    font-family: var(--global-font-family-sans);
    white-space: normal;
  }
`;

export type PendingDiffEdit<T> = {
  before: T;
  after: T;
  accept?: () => Promise<void>;
  reject?: () => Promise<void>;
};

export type DiffAcceptRejectToolDetailsProps<
  T,
  P extends PendingDiffEdit<T>,
> = {
  part: ToolInvocationPart;
  pending: P | null;
  snapshotToText: (snapshot: T) => string;
  fileName: string;
  renderHeader: (pending: P) => ReactNode;
  preparingLabel: string;
  preparingText: string;
  staleSessionMessage: string;
  showPreparing: boolean;
};

export function DiffAcceptRejectToolDetails<T, P extends PendingDiffEdit<T>>({
  part,
  pending,
  snapshotToText,
  fileName,
  renderHeader,
  preparingLabel,
  preparingText,
  staleSessionMessage,
  showPreparing,
}: DiffAcceptRejectToolDetailsProps<T, P>) {
  return (
    <div className="tool-part__body" css={diffAcceptRejectToolDetailsCSS}>
      {pending != null ? (
        <PendingDiff
          pending={pending}
          snapshotToText={snapshotToText}
          fileName={fileName}
          renderHeader={renderHeader}
          staleSessionMessage={staleSessionMessage}
        />
      ) : null}
      {part.state === "output-available" ? (
        <>
          <ToolPartLabel>Result</ToolPartLabel>
          <ToolPartCodeBlock>
            {stringifyToolValue(part.output)}
          </ToolPartCodeBlock>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
      {pending == null && showPreparing ? (
        <>
          <ToolPartLabel>{preparingLabel}</ToolPartLabel>
          <ToolPartCodeBlock>{preparingText}</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

function PendingDiff<T, P extends PendingDiffEdit<T>>({
  pending,
  snapshotToText,
  fileName,
  renderHeader,
  staleSessionMessage,
}: {
  pending: P;
  snapshotToText: (snapshot: T) => string;
  fileName: string;
  renderHeader: (pending: P) => ReactNode;
  staleSessionMessage: string;
}) {
  const { theme } = useTheme();
  const canRespond = Boolean(pending.accept && pending.reject);
  const fileDiff = useMemo(() => {
    return parseDiffFromFile(
      { name: fileName, contents: snapshotToText(pending.before) },
      { name: fileName, contents: snapshotToText(pending.after) }
    );
  }, [pending, fileName, snapshotToText]);

  return (
    <Flex direction="column" gap="size-100">
      <div className="diff-accept-reject__header">{renderHeader(pending)}</div>
      <div className="diff-accept-reject__diff">
        <FileDiff
          fileDiff={fileDiff}
          data-background="transparent"
          options={{
            diffStyle: "unified",
            disableFileHeader: true,
            theme: { light: "pierre-light", dark: "pierre-dark" },
            themeType: theme,
            unsafeCSS: `
            pre, pre code, [data-line-type=context], [data-gutter], svg {
              background: var(--tool-call-body-background-color);
              stroke: unset;
              fill: unset;
            }

            [data-line-type] {
              border-right: none;
            }

            [data-code] {
              padding: 0;
              padding-bottom: var(--global-dimension-size-100)
            }

            [data-column-number] {
              padding-left: 1.5ch;
            }
            `,
          }}
        />
      </div>
      <ToolPartApprovalActions
        onAccept={() => void pending.accept?.()}
        onReject={() => void pending.reject?.()}
        isDisabled={!canRespond}
        staleMessage={staleSessionMessage}
      />
    </Flex>
  );
}
