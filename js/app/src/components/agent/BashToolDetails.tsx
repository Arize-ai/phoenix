import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
  getBashToolSummary,
} from "@phoenix/agent/tools/bash";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import {
  ToolPartApprovalActions,
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

/**
 * Approval card for a bash command whose `phoenix-gql` invocation contains a
 * GraphQL mutation. Shows the model-provided `mutation_intent` (when present)
 * with Accept/Reject actions that resume the deferred tool call.
 */
function BashMutationApproval({ part }: { part: ToolInvocationPart }) {
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const chatRuntime = useAgentChatRuntime();
  if (part.state !== "approval-requested") {
    return null;
  }
  const mutationIntent = getBashToolInput(part.input)?.mutation_intent;
  const approvalId = part.approval.id;
  const respondToApproval = (approved: boolean) => {
    if (!activeSessionId) {
      return;
    }
    const chat = chatRuntime.getChat(activeSessionId);
    if (!chat) {
      return;
    }
    void chat.addToolApprovalResponse({
      id: approvalId,
      approved,
      ...(approved
        ? null
        : { reason: "The user rejected the GraphQL mutation." }),
    });
  };
  return (
    <>
      <ToolPartLabel variant="warning">
        Mutation approval required
      </ToolPartLabel>
      {mutationIntent ? (
        <ToolPartCodeBlock allowCopy={false}>
          {mutationIntent}
        </ToolPartCodeBlock>
      ) : null}
      <ToolPartApprovalActions
        onAccept={() => respondToApproval(true)}
        onReject={() => respondToApproval(false)}
      />
    </>
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
