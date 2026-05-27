import { css } from "@emotion/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";

import {
  type CodeEvaluatorDraftSnapshot,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  parseEditCodeEvaluatorDraftInput,
  type PendingCodeEvaluatorCreate,
  type PendingCodeEvaluatorCreateInline,
  type PendingCodeEvaluatorEdit,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { CREATE_CODE_EVALUATOR_TOOL_NAME } from "@phoenix/agent/tools/createCodeEvaluator";
import { Button, Flex, View } from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

const editCodeEvaluatorToolDetailsCSS = css`
  .edit-code-evaluator__header {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-250)
      var(--global-dimension-size-50);
  }

  .edit-code-evaluator__header-label {
    min-width: 0;
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .edit-code-evaluator__diff {
    font-family: var(--ac-global-font-family-sans);
    white-space: normal;
  }
`;

type PendingCodeEvaluatorChassis =
  | PendingCodeEvaluatorEdit
  | PendingCodeEvaluatorCreate;

type PendingCodeEvaluatorInlineChassis =
  | PendingCodeEvaluatorEdit
  | PendingCodeEvaluatorCreateInline;

const HANDOFF_STATUS_MESSAGE =
  "Editor opened on the dataset evaluators page.";

function isInlineChassis(
  pending: PendingCodeEvaluatorChassis
): pending is PendingCodeEvaluatorInlineChassis {
  return !("kind" in pending) || pending.kind === "inline";
}

export function getEditCodeEvaluatorDraftToolPreview(
  part: ToolInvocationPart
): string {
  if (part.type.endsWith(CREATE_CODE_EVALUATOR_TOOL_NAME)) {
    return "1 proposed evaluator";
  }
  const input = parseEditCodeEvaluatorDraftInput(part.input);
  if (!input) return "";
  return `${input.operations.length} proposed edit${input.operations.length === 1 ? "" : "s"}`;
}

export function formatEditCodeEvaluatorDraftState(
  part: ToolInvocationPart
): string {
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

export function EditCodeEvaluatorDraftToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pending = useAgentContext((state) => {
    return (
      state.pendingCodeEvaluatorEditsByToolCallId[part.toolCallId] ??
      state.pendingCodeEvaluatorCreatesByToolCallId[part.toolCallId] ??
      null
    );
  });

  const isHandoffPending =
    pending !== null && "kind" in pending && pending.kind === "handoff";

  return (
    <div className="tool-part__body" css={editCodeEvaluatorToolDetailsCSS}>
      {pending && isInlineChassis(pending) ? (
        <PendingCodeEvaluatorDraftDiff pending={pending} />
      ) : null}
      {isHandoffPending && part.state === "input-available" ? (
        <>
          <ToolPartLabel>{CREATE_CODE_EVALUATOR_TOOL_NAME}</ToolPartLabel>
          <ToolPartCodeBlock>{HANDOFF_STATUS_MESSAGE}</ToolPartCodeBlock>
        </>
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
      {!pending && part.state === "input-available" ? (
        <>
          <ToolPartLabel>{EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME}</ToolPartLabel>
          <ToolPartCodeBlock>
            Preparing code-evaluator draft diff...
          </ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

function PendingCodeEvaluatorDraftDiff({
  pending,
}: {
  pending: PendingCodeEvaluatorInlineChassis;
}) {
  const { theme } = useTheme();
  const canRespond = Boolean(pending.accept && pending.reject);
  const fileName =
    pending.before.mode === "edit"
      ? `code-evaluator-${pending.before.evaluatorNodeId ?? "draft"}.txt`
      : "code-evaluator-draft.txt";
  const fileDiff = useMemo(() => {
    return parseDiffFromFile(
      { name: fileName, contents: draftSnapshotToText(pending.before) },
      { name: fileName, contents: draftSnapshotToText(pending.after) }
    );
  }, [pending, fileName]);

  return (
    <Flex direction="column" gap="size-100">
      <div className="edit-code-evaluator__header">
        <span className="edit-code-evaluator__header-label">
          Proposed diff for code-evaluator draft ({pending.before.mode} mode)
        </span>
      </div>
      <div className="edit-code-evaluator__diff">
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
          <ToolPartCodeBlock>
            This proposal was made in an earlier session and can&apos;t be
            applied here. Re-run your request to have PXI propose it again.
          </ToolPartCodeBlock>
        ) : null}
      </View>
    </Flex>
  );
}

function draftSnapshotToText(snapshot: CodeEvaluatorDraftSnapshot): string {
  return [
    `name: ${snapshot.name}`,
    `description: ${snapshot.description}`,
    `language: ${snapshot.language}`,
    `sandboxConfigId: ${snapshot.sandboxConfigId ?? "null"}`,
    `inputMapping: ${JSON.stringify(snapshot.inputMapping, null, 2)}`,
    `outputConfigs: ${JSON.stringify(snapshot.outputConfigs, null, 2)}`,
    `sourceCode:\n${snapshot.sourceCode}`,
  ].join("\n\n");
}

function getOutputStatus(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = output as { status?: unknown };
  return typeof candidate.status === "string" ? candidate.status : null;
}
