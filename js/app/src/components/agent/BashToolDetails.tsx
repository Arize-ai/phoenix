import { Fragment } from "react";

import type { PendingGraphQLMutation } from "@phoenix/agent/chat/types";
import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
  getBashToolSummary,
} from "@phoenix/agent/tools/bash";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { isRecord } from "@phoenix/utils/typeUtils";

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
 * The pending GraphQL mutations stamped on a deferred bash tool call's
 * persisted `callProviderMetadata`, if present.
 */
function getPendingMutationsFromPart(
  part: ToolInvocationPart
): PendingGraphQLMutation[] | null {
  const callProviderMetadata: unknown = part.callProviderMetadata;
  const phoenixMetadata: unknown = isRecord(callProviderMetadata)
    ? callProviderMetadata.phoenix
    : null;
  const pendingMutations: unknown = isRecord(phoenixMetadata)
    ? phoenixMetadata.pendingMutations
    : null;
  return Array.isArray(pendingMutations) && pendingMutations.length > 0
    ? (pendingMutations as PendingGraphQLMutation[])
    : null;
}

/**
 * Approval card for a bash command whose `phoenix-gql` invocation contains a
 * GraphQL mutation. Shows the resolved mutation document and variables —
 * captured server-side after file/stdin indirection, so the user reviews
 * exactly what will execute — with Accept/Reject actions that resume the
 * deferred tool call.
 */
function BashMutationApproval({ part }: { part: ToolInvocationPart }) {
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const livePendingMutations = useAgentContext(
    (state) => state.pendingBashMutationsByToolCallId[part.toolCallId] ?? null
  );
  const chatRuntime = useAgentChatRuntime();
  if (part.state !== "approval-requested") {
    return null;
  }
  const pendingMutations =
    getPendingMutationsFromPart(part) ?? livePendingMutations ?? [];
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
      <ToolPartLabel>Mutation approval required</ToolPartLabel>
      {pendingMutations.map((mutation, index) => (
        <Fragment key={mutation.digest ?? index}>
          <ToolPartExpandableSection>
            <ToolPartCodeBlock>{mutation.query}</ToolPartCodeBlock>
          </ToolPartExpandableSection>
          {mutation.variables != null ? (
            <>
              <ToolPartLabel>Variables</ToolPartLabel>
              <ToolPartExpandableSection>
                <ToolPartCodeBlock>
                  {stringifyToolValue(mutation.variables)}
                </ToolPartCodeBlock>
              </ToolPartExpandableSection>
            </>
          ) : null}
        </Fragment>
      ))}
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
