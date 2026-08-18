import { css } from "@emotion/react";

import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
  getBashToolSummary,
} from "@phoenix/agent/tools/bash";

import { ToolApprovalRequest } from "./ToolApprovalRequest";
import {
  ToolPartCodeBlock,
  ToolPartExpandableSection,
  ToolPartLabel,
  ToolPartMeta,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

/**
 * Returns the preview text for the collapsed bash tool summary.
 */
export function getBashToolPreview(part: ToolInvocationPart): string {
  const summary = getBashToolSummary(part.input);
  if (summary) {
    return summary;
  }
  const command = getBashToolInput(part.input)?.command;
  return command ? command.split("\n")[0] : "";
}

const bashMutationApprovalCSS = css`
  .bash-mutation-approval__description {
    margin: 0;
    padding: var(--global-dimension-size-50) var(--global-dimension-size-250)
      var(--global-dimension-size-125);
    font-family: var(--global-font-family-sans);
    color: var(--global-text-color-900);
    white-space: normal;
    overflow-wrap: anywhere;
  }
`;

/**
 * Approval card for a bash command that invokes a GraphQL mutation.
 *
 * The card shows the model's plain-text description of the change; the command
 * itself renders above it. Nothing has executed at this point — the tool call
 * is deferred before the shell runs — so rejecting leaves no side effects.
 */
function BashMutationApproval({ part }: { part: ToolInvocationPart }) {
  const mutationDescription = getBashToolInput(
    part.input
  )?.mutation_description;
  return (
    <div css={bashMutationApprovalCSS}>
      <ToolApprovalRequest
        part={part}
        label="Approval required to change data"
        denialReason="The user rejected the GraphQL mutation."
      >
        {mutationDescription ? (
          <p className="bash-mutation-approval__description">
            {mutationDescription}
          </p>
        ) : null}
      </ToolApprovalRequest>
    </div>
  );
}

/**
 * Expanded detail view for a bash tool invocation showing the command
 * and stdout output.
 */
export function BashToolDetails({ part }: { part: ToolInvocationPart }) {
  const bashInput = getBashToolInput(part.input);
  const bashResult = getBashToolCommandDisplayResult(part.output);
  const command = bashInput?.command ?? stringifyToolValue(part.input);
  const stdout = bashResult?.stdout || "";

  const metaItems = [
    { label: "Exit code", value: bashResult?.exitCode ?? 0 },
    ...(bashResult?.durationText
      ? [{ label: "Duration", value: bashResult.durationText }]
      : []),
  ];

  return (
    <div className="tool-part__body">
      <ToolPartLabel>Command</ToolPartLabel>
      <ToolPartExpandableSection>
        <ToolPartCodeBlock>{command}</ToolPartCodeBlock>
      </ToolPartExpandableSection>
      {part.state === "approval-requested" ? (
        <BashMutationApproval part={part} />
      ) : null}
      {part.state === "output-available" ? (
        <>
          {stdout ? (
            <>
              <ToolPartLabel>Output</ToolPartLabel>
              <ToolPartExpandableSection>
                <ToolPartCodeBlock>{stdout}</ToolPartCodeBlock>
              </ToolPartExpandableSection>
            </>
          ) : null}
          <ToolPartMeta items={metaItems} />
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartExpandableSection>
            <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
          </ToolPartExpandableSection>
        </>
      ) : null}
    </div>
  );
}
