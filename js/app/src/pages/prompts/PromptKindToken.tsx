import type { TokenProps } from "@phoenix/components/core/token";
import { Token } from "@phoenix/components/core/token";

import type { PromptsTableRowKind } from "./promptsTableRows";

const KIND_COLORS: Record<PromptsTableRowKind, TokenProps["color"]> = {
  prompt: "var(--global-color-blue-500)",
  // Matches the DECISION evaluator kind token
  decision: "var(--global-color-seafoam-500)",
};

const KIND_LABELS: Record<PromptsTableRowKind, string> = {
  prompt: "PROMPT",
  decision: "DECISION",
};

/**
 * A badge naming whether a row of the prompts table is a prompt or a decision
 */
export function PromptKindToken({
  kind,
  size = "S",
}: {
  kind: PromptsTableRowKind;
  size?: TokenProps["size"];
}) {
  return (
    <Token color={KIND_COLORS[kind]} size={size}>
      {KIND_LABELS[kind]}
    </Token>
  );
}
