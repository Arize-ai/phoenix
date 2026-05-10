import { css } from "@emotion/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";

import {
  EDIT_PROMPT_TOOL_NAME,
  parseEditPromptInput,
  type PendingPromptEdit,
  type PromptSnapshot,
  type PromptMessageSnapshot,
} from "@phoenix/agent/tools/playgroundPrompt";
import { Button, Flex, View } from "@phoenix/components";
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
      return status === "rejected" ? "Rejected" : "Accepted";
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

  return (
    <div className="tool-part__body" css={editPromptToolDetailsCSS}>
      {pendingEdit ? <PendingEditPromptDiff pendingEdit={pendingEdit} /> : null}
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
      {!pendingEdit && input && part.state === "input-available" ? (
        <>
          <ToolPartLabel>{EDIT_PROMPT_TOOL_NAME}</ToolPartLabel>
          <ToolPartCodeBlock>Preparing prompt edit diff...</ToolPartCodeBlock>
        </>
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

function promptSnapshotToText(snapshot: PromptSnapshot): string {
  return snapshot.messages.map(formatMessage).join("\n\n");
}

function formatMessage(message: PromptMessageSnapshot): string {
  return [
    `role: ${message.role}`,
    message.content !== undefined ? `content:\n${message.content}` : null,
    message.toolCalls !== undefined
      ? `toolCalls:\n${JSON.stringify(message.toolCalls, null, 2)}`
      : null,
  ]
    .filter((line): line is string => line != null)
    .join("\n\n");
}

function getOutputStatus(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = output as { status?: unknown };
  return typeof candidate.status === "string" ? candidate.status : null;
}
