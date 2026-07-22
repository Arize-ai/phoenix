import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { z } from "zod";

import {
  parseSavePromptInput,
  parseSavePromptResult,
  SAVE_PROMPT_TOOL_NAME,
  type PendingSavePrompt,
  type SavePromptMode,
  type SavePromptPreview,
} from "@phoenix/agent/tools/playgroundSavePrompt";
import { Flex, Link, Token } from "@phoenix/components";
import { getPromptVersionTagColor } from "@phoenix/constants/promptConstants";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

const savePromptToolDetailsCSS = css`
  && {
    padding-bottom: 0;
  }

  .save-prompt__preview {
    list-style: none;
    margin: 0;
    padding: var(--global-dimension-size-50) var(--global-dimension-size-250)
      var(--global-dimension-size-125);
    display: grid;
    gap: var(--global-dimension-size-75);
    font-family: var(--global-font-family-sans);
    white-space: normal;
  }

  .save-prompt__preview-row {
    display: grid;
    grid-template-columns: minmax(7rem, max-content) minmax(0, 1fr);
    gap: var(--global-dimension-size-150);
    align-items: baseline;
    min-width: 0;
  }

  .save-prompt__preview-label {
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .save-prompt__preview-value {
    min-width: 0;
    color: var(--global-text-color-900);
    overflow-wrap: anywhere;
  }

  .save-prompt__tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-50);
    min-width: 0;
  }
`;

export function getSavePromptToolPreview(part: ToolInvocationPart): string {
  // Once the save resolves we know the real prompt name — surface it instead
  // of the generic verb so the collapsed summary reads, e.g. "support_router".
  const result = parseSavePromptResult(part.output);
  if (result) {
    return result.mode === "create"
      ? `Save as ${result.promptName}`
      : `Update ${result.promptName}`;
  }
  const input = parseSavePromptInput(part.input);
  if (!input) return "";
  if (input.name) return `Save as ${input.name}`;
  if (input.promptId) return "Save prompt version";
  return "Save prompt";
}

/**
 * Semantic color for the collapsed tool-summary status pill, kept in sync with
 * the body heading: a completed save reads success, a rejection reads warning,
 * and a failure reads danger.
 */
export function getSavePromptStatusVariant(
  part: ToolInvocationPart
): "danger" | "warning" | "success" | undefined {
  if (part.state === "output-error") return "danger";
  if (part.state === "output-available") {
    return getOutputStatus(part.output) === "rejected" ? "warning" : "success";
  }
  return undefined;
}

export function formatSavePromptState(part: ToolInvocationPart): string {
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

export function SavePromptToolDetails({ part }: { part: ToolInvocationPart }) {
  const pendingSave = useAgentContext(
    (state) => state.pendingSavePromptsByToolCallId[part.toolCallId] ?? null
  );
  const input = parseSavePromptInput(part.input);
  const isResolved = part.state === "output-available";
  const isRejected = isResolved && getOutputStatus(part.output) === "rejected";

  return (
    <div className="tool-part__body" css={savePromptToolDetailsCSS}>
      {pendingSave ? (
        <PendingSavePromptDetails pendingSave={pendingSave} />
      ) : null}
      {isResolved && !isRejected ? (
        <SavePromptResultDetails output={part.output} />
      ) : null}
      {isRejected ? (
        <ToolPartLabel variant="warning">Save rejected</ToolPartLabel>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
      {!pendingSave && input && part.state === "input-available" ? (
        <>
          <ToolPartLabel>{SAVE_PROMPT_TOOL_NAME}</ToolPartLabel>
          <ToolPartCodeBlock>
            Preparing prompt save approval...
          </ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

function SavePromptResultDetails({ output }: { output: unknown }) {
  const result = parseSavePromptResult(output);
  if (!result) {
    return (
      <>
        <ToolPartLabel>Result</ToolPartLabel>
        <ToolPartCodeBlock>{stringifyToolValue(output)}</ToolPartCodeBlock>
      </>
    );
  }

  const promptPath = `/prompts/${result.promptId}`;
  const versionPath = `/prompts/${result.promptId}/versions/${result.promptVersionId}`;

  return (
    <>
      <ToolPartLabel variant="success">
        {savedModeLabel(result.mode)}
      </ToolPartLabel>
      <ul className="save-prompt__preview">
        <SavePromptPreviewRow label="Prompt">
          <Link to={promptPath}>{result.promptName}</Link>
        </SavePromptPreviewRow>
        {result.tag ? (
          <SavePromptPreviewRow label="Tag">
            <SavePromptTags tags={[result.tag]} />
          </SavePromptPreviewRow>
        ) : null}
        <SavePromptPreviewRow label="Version">
          <Link to={versionPath}>View version</Link>
        </SavePromptPreviewRow>
      </ul>
    </>
  );
}

function PendingSavePromptDetails({
  pendingSave,
}: {
  pendingSave: PendingSavePrompt;
}) {
  const canRespond = Boolean(pendingSave.accept && pendingSave.reject);
  return (
    <Flex direction="column" gap="size-100" minHeight="0">
      <ToolPartLabel>
        {proposedModeLabel(pendingSave.preview.mode)}
      </ToolPartLabel>
      <SavePromptPreviewBlock preview={pendingSave.preview} />
      <ToolPartApprovalActions
        onAccept={() => void pendingSave.accept?.()}
        onReject={() => void pendingSave.reject?.()}
        isDisabled={!canRespond}
        staleMessage="This prompt save was proposed in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      />
    </Flex>
  );
}

function SavePromptPreviewBlock({ preview }: { preview: SavePromptPreview }) {
  return (
    <ul className="save-prompt__preview">
      <SavePromptPreviewRow label="Prompt">
        {preview.promptName}
      </SavePromptPreviewRow>
      {preview.description ? (
        <SavePromptPreviewRow label="Description">
          {preview.description}
        </SavePromptPreviewRow>
      ) : null}
      {preview.tags.length > 0 ? (
        <SavePromptPreviewRow label="Tags">
          <SavePromptTags tags={preview.tags} />
        </SavePromptPreviewRow>
      ) : null}
    </ul>
  );
}

/** Render version tags with the same coloring used on the prompt pages. */
function SavePromptTags({ tags }: { tags: string[] }) {
  return (
    <span className="save-prompt__tags">
      {tags.map((tag) => (
        <Token
          key={tag}
          size="S"
          color={getPromptVersionTagColor(tag)}
          title={tag}
        >
          {tag}
        </Token>
      ))}
    </span>
  );
}

function savedModeLabel(mode: SavePromptMode): string {
  return mode === "create" ? "Created prompt" : "Saved new version";
}

function proposedModeLabel(mode: SavePromptMode): string {
  return mode === "create" ? "Create prompt" : "Save new version";
}

function SavePromptPreviewRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="save-prompt__preview-row">
      <span className="save-prompt__preview-label">{label}</span>
      <div className="save-prompt__preview-value">{children}</div>
    </li>
  );
}

const outputStatusSchema = z.object({ status: z.string() });
const autoAcceptedSchema = z.object({ acceptedBy: z.literal("auto") });

function getOutputStatus(output: unknown): string | null {
  return outputStatusSchema.safeParse(output).data?.status ?? null;
}

function isAutoAccepted(output: unknown): boolean {
  return autoAcceptedSchema.safeParse(output).success;
}
