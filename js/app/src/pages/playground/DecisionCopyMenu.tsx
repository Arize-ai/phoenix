import copy from "copy-to-clipboard";
import { useState } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
  Text,
} from "@phoenix/components";
import type { DecisionQuestionDraft } from "@phoenix/store/playground/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  toDecisionResponseFormat,
  toDecisionToolDefinition,
  toSystemOneQuestion,
} from "./decisionUtils";

const SHOW_COPIED_TIMEOUT_MS = 2000;

type CopyFormat = "question" | "response_format" | "tool";

const COPY_FORMATS: ReadonlyArray<{
  id: CopyFormat;
  label: string;
  description: string;
}> = [
  {
    id: "question",
    label: "Question JSON",
    description: "The question as the decision API receives it.",
  },
  {
    id: "response_format",
    label: "Response format",
    description: "An LLM response format whose schema answers this question.",
  },
  {
    id: "tool",
    label: "Tool definition",
    description: "An LLM function tool whose arguments answer this question.",
  },
];

function toCopyText({
  question,
  format,
}: {
  question: DecisionQuestionDraft;
  format: CopyFormat;
}): string {
  const name = question.name.trim() || "question";
  switch (format) {
    case "question":
      return JSON.stringify(
        { [name]: toSystemOneQuestion({ question }) },
        null,
        2
      );
    case "response_format":
      return JSON.stringify(
        toDecisionResponseFormat({ questions: [question], name }),
        null,
        2
      );
    case "tool":
      return JSON.stringify(
        toDecisionToolDefinition({ questions: [question], name }),
        null,
        2
      );
    default:
      return assertUnreachable(format);
  }
}

/**
 * Copy one question as the decision API sees it, or as an LLM response
 * format or tool with the same answer shape, so a decision question can be
 * handed to a chat model and the two compared.
 * @param props.question - the question to copy
 * @param props.label - the question's display name, for the button's label
 */
export function DecisionCopyMenu({
  question,
  label,
}: {
  question: DecisionQuestionDraft;
  label: string;
}) {
  const [isCopied, setIsCopied] = useState(false);
  return (
    <MenuTrigger>
      <Button
        size="S"
        aria-label={`Copy ${label} question as…`}
        leadingVisual={
          <Icon
            color={isCopied ? "success" : "inherit"}
            svgKey={isCopied ? "Checkmark" : "Duplicate"}
          />
        }
        trailingVisual={<Icon svg={<Icons.ChevronDownSmall />} />}
      />
      {/* Three fixed entries; the default minimum height is for long lists. */}
      <MenuContainer placement="bottom end" minHeight="auto">
        <Menu
          onAction={(key) => {
            const format = COPY_FORMATS.find(
              (candidate) => candidate.id === key
            );
            if (!format) return;
            copy(toCopyText({ question, format: format.id }));
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), SHOW_COPIED_TIMEOUT_MS);
          }}
        >
          {COPY_FORMATS.map((format) => (
            <MenuItem key={format.id} id={format.id} textValue={format.label}>
              <Flex direction="column">
                <Text>{format.label}</Text>
                <Text size="XS" color="text-700">
                  {format.description}
                </Text>
              </Flex>
            </MenuItem>
          ))}
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}
