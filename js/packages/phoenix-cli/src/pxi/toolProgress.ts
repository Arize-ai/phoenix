import type { UIDataTypes, UIMessagePart, UITools } from "ai";

import type { PxiMessage } from "./types";

export type ToolProgressState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export type ToolProgress = {
  toolCallId: string;
  toolName: string;
  state: ToolProgressState;
  statusText: string;
  errorText?: string;
};

type PxiToolPart = UIMessagePart<UIDataTypes, UITools> & {
  toolCallId: string;
  state: ToolProgressState;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function isPxiToolPart(
  part: UIMessagePart<UIDataTypes, UITools>
): part is PxiToolPart {
  return (
    "toolCallId" in part &&
    "state" in part &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function getToolName(part: PxiToolPart): string {
  return part.type === "dynamic-tool"
    ? (part.toolName ?? "dynamic-tool")
    : part.type.replace(/^tool-/, "");
}

function getStatusText(state: ToolProgressState): string {
  switch (state) {
    case "input-streaming":
      return "Preparing";
    case "input-available":
      return "Running";
    case "approval-requested":
      return "Awaiting approval";
    case "approval-responded":
      return "Approval recorded";
    case "output-available":
      return "Complete";
    case "output-error":
      return "Failed";
    case "output-denied":
      return "Denied";
  }
}

export function getToolProgressFromMessages(
  messages: readonly PxiMessage[]
): ToolProgress[] {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) => {
      const toolProgress = getToolProgressFromPart({ part });
      return toolProgress ? [toolProgress] : [];
    })
  );
}

export function getToolProgressFromPart({
  part,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
}): ToolProgress | null {
  if (!isPxiToolPart(part)) {
    return null;
  }
  const toolName = getToolName(part);
  const state = part.state;
  return {
    toolCallId: part.toolCallId,
    toolName,
    state,
    statusText: getStatusText(state),
    errorText: "errorText" in part ? part.errorText : undefined,
  };
}

export function getMessageText({ message }: { message: PxiMessage }): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
