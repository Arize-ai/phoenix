import { css } from "@emotion/react";

import type { AgentContext } from "@phoenix/agent/context/agentContexts";
import { Token } from "@phoenix/components/core/token";

const promptContextPillsCSS = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-static-size-100);
  padding: 0 var(--global-dimension-size-150)
    var(--global-dimension-size-100);
`;

function truncateIdentifier(value: string, visibleLength = 8) {
  if (value.length <= visibleLength * 2 + 1) {
    return value;
  }

  return `${value.slice(0, visibleLength)}...${value.slice(-visibleLength)}`;
}

function truncateText(value: string, maxLength = 36) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function getAgentContextTokenLabel(context: AgentContext) {
  switch (context.type) {
    case "project":
      return `Project ${truncateIdentifier(context.projectId)}`;
    case "trace":
      return `Trace ${truncateIdentifier(context.traceId)}`;
    case "span":
      return `Span ${truncateIdentifier(context.spanNodeId)}`;
    case "span_filter_condition":
      return `Filter ${truncateText(context.filterCondition)}`;
  }
}

function getAgentContextTokenTitle(context: AgentContext) {
  switch (context.type) {
    case "project":
      return `Project: ${context.projectId}`;
    case "trace":
      return `Trace: ${context.traceId}`;
    case "span":
      return `Span: ${context.spanNodeId}`;
    case "span_filter_condition":
      return `Span filter: ${context.filterCondition}`;
  }
}

function getAgentContextReactKey(context: AgentContext) {
  switch (context.type) {
    case "project":
      return `project:${context.projectId}`;
    case "trace":
      return `trace:${context.projectId}:${context.traceId}`;
    case "span":
      return `span:${context.projectId}:${context.traceId}:${context.spanNodeId}`;
    case "span_filter_condition":
      return `span_filter_condition:${context.projectId}:${context.filterCondition}`;
  }
}

export function PromptContextPills({ contexts }: { contexts: AgentContext[] }) {
  if (contexts.length === 0) {
    return null;
  }

  return (
    <div css={promptContextPillsCSS} data-testid="prompt-context-pills">
      {contexts.map((context) => (
        <Token
          key={getAgentContextReactKey(context)}
          size="S"
          title={getAgentContextTokenTitle(context)}
          maxWidth="100%"
        >
          {getAgentContextTokenLabel(context)}
        </Token>
      ))}
    </div>
  );
}
