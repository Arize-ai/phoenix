import { css } from "@emotion/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { type ReactNode, useMemo } from "react";

import { Button, Flex, View } from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";

import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
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
    font-family: var(--ac-global-font-family-sans);
    white-space: normal;
  }
`;

/**
 * The accept/reject contract every pending-edit kind satisfies; domain data
 * lives on `T`, reached via `snapshotToText`.
 */
type PendingDiffEdit<T> = {
  before: T;
  after: T;
  accept?: () => Promise<void>;
  reject?: () => Promise<void>;
};

type DiffAcceptRejectToolDetailsProps<T, P extends PendingDiffEdit<T>> = {
  part: ToolInvocationPart;
  /** The pending edit read from the owning tool's zustand slice, or null. */
  pending: P | null;
  /** Serializes a snapshot to the plain text the diff is computed over. */
  snapshotToText: (snapshot: T) => string;
  /** Diff file name (drives the `before`/`after` blobs handed to the differ). */
  fileName: string;
  /** The proposed-diff header content for the pending edit. */
  renderHeader: (pending: P) => ReactNode;
  /** Label shown above the placeholder while the diff is still preparing. */
  preparingLabel: string;
  /** Placeholder text shown while the diff is still preparing. */
  preparingText: string;
  /** Message shown when the edit can no longer be accepted/rejected. */
  staleSessionMessage: string;
  /**
   * Whether to show the preparing placeholder for an in-flight call. Wrappers
   * can add their own guards (e.g. waiting on parsed input) before this is set.
   */
  showPreparing: boolean;
};

/**
 * Shared renderer for pending-edit tool details: a proposed diff with
 * accept/reject controls. Wrappers inject the domain content; the `pending`
 * edit is passed in and this component never reads context or the store.
 */
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
              padding-bottom: var(--global-dimension-static-size-100)
            }

            [data-column-number] {
              padding-left: 1.5ch;
            }
            `,
          }}
        />
      </div>
      <View paddingX="size-200">
        <Flex direction="row-reverse" gap="size-100">
          <Button
            size="S"
            variant="primary"
            isDisabled={!canRespond}
            onPress={() => void pending.accept?.()}
          >
            Accept
          </Button>
          <Button
            size="S"
            isDisabled={!canRespond}
            onPress={() => void pending.reject?.()}
          >
            Reject
          </Button>
        </Flex>
        {!canRespond ? (
          <ToolPartCodeBlock>{staleSessionMessage}</ToolPartCodeBlock>
        ) : null}
      </View>
    </Flex>
  );
}
