import { css } from "@emotion/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";

import {
  EDIT_PROMPT_TOOL_NAME,
  parseEditPromptInput,
  type PendingPromptEdit,
  type PromptEditSummary,
  promptSnapshotToText,
} from "@phoenix/agent/tools/playgroundPrompt";
import { Button, Flex, Text, View } from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { useTheme } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

const editPromptToolDetailsCSS = css`
  .edit-prompt__header {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-250)
      var(--global-dimension-size-50);
  }

  .edit-prompt__header-icon {
    flex-shrink: 0;
  }

  .edit-prompt__header-label {
    min-width: 0;
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .edit-prompt__diff {
    font-family: var(--ac-global-font-family-sans);
    white-space: normal;
  }

  .edit-prompt__summary {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
    padding: var(--global-dimension-size-50) var(--global-dimension-size-250)
      var(--global-dimension-size-125);
    font-family: var(--ac-global-font-family-sans);
    white-space: normal;
  }

  .edit-prompt__summary-icon {
    flex-shrink: 0;
  }

  .edit-prompt__summary-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edit-prompt__summary-stat {
    flex-shrink: 0;
    font-family: var(--ac-global-font-family-code);
    font-size: var(--global-font-size-xs);
  }

  .edit-prompt__summary-stat[data-kind="additions"] {
    color: var(--global-color-success);
  }

  .edit-prompt__summary-stat[data-kind="deletions"] {
    color: var(--global-color-danger);
  }
`;

export function getEditPromptToolPreview(part: ToolInvocationPart): string {
  const input = parseEditPromptInput(part.input);
  if (!input) return "";
  return `${input.operations.length} proposed edit${input.operations.length === 1 ? "" : "s"}`;
}

export function formatEditPromptState(part: ToolInvocationPart): string {
  switch (part.state) {
    case "input-available":
      return "Awaiting approval";
    case "output-available": {
      const status = getOutputStatus(part.output);
      if (status === "rejected") return "Rejected";
      return isAutoAccepted(part.output) ? "Auto-approved" : "Accepted";
    }
    default:
      return formatToolState(part.state);
  }
}

export function EditPromptToolDetails({ part }: { part: ToolInvocationPart }) {
  const pendingEdit = useAgentContext(
    (state) => state.pendingPromptEditsByToolCallId[part.toolCallId] ?? null
  );
  const input = parseEditPromptInput(part.input);
  const isResolved = part.state === "output-available";
  const isRejected = isResolved && getOutputStatus(part.output) === "rejected";
  const summary = isResolved ? getEditSummary(part.output) : null;

  return (
    <div className="tool-part__body" css={editPromptToolDetailsCSS}>
      {pendingEdit ? <PendingEditPromptDiff pendingEdit={pendingEdit} /> : null}
      {isResolved && !isRejected ? (
        summary ? (
          <EditPromptSummary summary={summary} />
        ) : (
          <>
            <ToolPartLabel>Result</ToolPartLabel>
            <ToolPartCodeBlock>
              {stringifyToolValue(part.output)}
            </ToolPartCodeBlock>
          </>
        )
      ) : null}
      {isRejected ? (
        <ToolPartLabel variant="warning">Edit rejected</ToolPartLabel>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
      {!pendingEdit && input && part.state === "input-available" ? (
        <>
          <ToolPartLabel>{EDIT_PROMPT_TOOL_NAME}</ToolPartLabel>
          <ToolPartCodeBlock>Preparing prompt edit diff...</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

/**
 * Compact summary shown after a prompt edit is applied: the
 * edited instance (A/B/C…) and the added/removed line counts.
 */
function EditPromptSummary({ summary }: { summary: PromptEditSummary }) {
  return (
    <div className="edit-prompt__summary">
      <div className="edit-prompt__summary-icon">
        <AlphabeticIndexIcon index={summary.instanceIndex} size="XS" />
      </div>
      <Text size="XS" className="edit-prompt__summary-label">
        Instance {summary.instanceLabel} edited
      </Text>
      {summary.additions > 0 ? (
        <span className="edit-prompt__summary-stat" data-kind="additions">
          +{summary.additions}
        </span>
      ) : null}
      {summary.deletions > 0 ? (
        <span className="edit-prompt__summary-stat" data-kind="deletions">
          −{summary.deletions}
        </span>
      ) : null}
    </div>
  );
}

function PendingEditPromptDiff({
  pendingEdit,
}: {
  pendingEdit: PendingPromptEdit;
}) {
  const { theme } = useTheme();
  const canRespond = Boolean(pendingEdit.accept && pendingEdit.reject);
  const fileDiff = useMemo(() => {
    return parseDiffFromFile(
      {
        name: `playground-instance-${pendingEdit.instanceId}.txt`,
        contents: promptSnapshotToText(pendingEdit.before),
      },
      {
        name: `playground-instance-${pendingEdit.instanceId}.txt`,
        contents: promptSnapshotToText(pendingEdit.after),
      }
    );
  }, [pendingEdit]);

  return (
    <Flex direction="column" gap="size-100">
      <div className="edit-prompt__header">
        <div className="edit-prompt__header-icon">
          <AlphabeticIndexIcon index={pendingEdit.before.index} size="XS" />
        </div>
        <span className="edit-prompt__header-label">
          Proposed diff for {pendingEdit.before.label} (instance{" "}
          {pendingEdit.instanceId})
        </span>
      </div>
      <div className="edit-prompt__diff">
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
            onPress={() => void pendingEdit.accept?.()}
          >
            Accept
          </Button>
          <Button
            size="S"
            isDisabled={!canRespond}
            onPress={() => void pendingEdit.reject?.()}
          >
            Reject
          </Button>
        </Flex>
        {!canRespond ? (
          <ToolPartCodeBlock>
            This edit was proposed in an earlier session and can&apos;t be
            applied here. Re-run your request to have PXI propose it again.
          </ToolPartCodeBlock>
        ) : null}
      </View>
    </Flex>
  );
}

function getOutputStatus(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = output as { status?: unknown };
  return typeof candidate.status === "string" ? candidate.status : null;
}

function getAcceptedBy(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = output as { acceptedBy?: unknown };
  return typeof candidate.acceptedBy === "string" ? candidate.acceptedBy : null;
}

function isAutoAccepted(output: unknown): boolean {
  const acceptedBy = getAcceptedBy(output);
  return acceptedBy === "auto" || acceptedBy === "system";
}

/** Reads the persisted edit summary of a resolved tool output. */
function getEditSummary(output: unknown): PromptEditSummary | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = (output as { summary?: unknown }).summary;
  if (typeof candidate !== "object" || candidate === null) return null;
  const summary = candidate as Partial<PromptEditSummary>;
  if (
    typeof summary.instanceIndex !== "number" ||
    typeof summary.instanceLabel !== "string" ||
    typeof summary.additions !== "number" ||
    typeof summary.deletions !== "number"
  ) {
    return null;
  }
  return {
    instanceIndex: summary.instanceIndex,
    instanceLabel: summary.instanceLabel,
    additions: summary.additions,
    deletions: summary.deletions,
  };
}
