import { css } from "@emotion/react";

import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
  getBashToolPendingMutations,
  getBashToolSummary,
} from "@phoenix/agent/tools/bash";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

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
  .bash-mutation-approval__intent {
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
 * Approval card for a bash command whose `phoenix-gql` invocation contains
 * GraphQL mutations.
 */
function BashMutationApproval({ part }: { part: ToolInvocationPart }) {
  // Live streams deliver the resolved mutations via the
  // `data-bash-mutation-approval` chunk into the store; reloaded transcripts
  // carry the same payload on the part's call provider metadata.
  const streamedMutations = useAgentContext(
    (state) => state.pendingBashMutationsByToolCallId[part.toolCallId] ?? null
  );
  const pendingMutations =
    streamedMutations ?? getBashToolPendingMutations(part) ?? [];
  const mutationIntent = getBashToolInput(part.input)?.mutation_intent;
  return (
    <div css={bashMutationApprovalCSS}>
      <ToolApprovalRequest
        part={part}
        label="Mutation approval required"
        denialReason="The user rejected the GraphQL mutation."
      >
        {mutationIntent ? (
          <p className="bash-mutation-approval__intent">{mutationIntent}</p>
        ) : null}
        {pendingMutations.map((mutation, index) => (
          <div key={mutation.digest}>
            <ToolPartLabel>
              {pendingMutations.length > 1
                ? `Mutation ${index + 1}`
                : "Mutation"}
            </ToolPartLabel>
            <ToolPartExpandableSection>
              <ToolPartCodeBlock>{mutation.query}</ToolPartCodeBlock>
            </ToolPartExpandableSection>
            {mutation.variables &&
            Object.keys(mutation.variables).length > 0 ? (
              <>
                <ToolPartLabel>Variables</ToolPartLabel>
                <ToolPartExpandableSection>
                  <ToolPartCodeBlock>
                    {JSON.stringify(mutation.variables, null, 2)}
                  </ToolPartCodeBlock>
                </ToolPartExpandableSection>
              </>
            ) : null}
          </div>
        ))}
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
