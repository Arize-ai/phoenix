import { css } from "@emotion/react";

import type {
  ElicitationAnswers,
  ElicitationFreeformTexts,
  ElicitationQuestion,
  ElicitToolInput,
  ElicitToolOutput,
} from "@phoenix/agent/tools/elicit";
import { parseElicitToolInput } from "@phoenix/agent/tools/elicit";

import { useElicitationDraft } from "./ElicitationDraftContext";
import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart, ToolUIPartState } from "./toolPartTypes";
import { formatToolState } from "./toolPartTypes";

const FREEFORM_OPTION_ID = "__freeform__";
const ASK_USER_CANCELLED_ERROR_TEXT = "User cancelled the question.";

const askUserToolDetailsCSS = css`
  .ask-user__list-block {
    padding-bottom: var(--global-dimension-size-150);
  }

  .ask-user__list {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
  }

  .ask-user__list-line {
    display: flex;
    align-items: flex-start;
    white-space: normal;
  }

  .ask-user__list-index {
    color: var(--tool-call-secondary-color);
    flex: 0 0 auto;
    margin-right: var(--global-dimension-size-50);
  }

  .ask-user__list-text {
    flex: 1;
    min-width: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ask-user__list-line[data-status="current"],
  .ask-user__list-line[data-status="pending"] {
    color: var(--tool-call-secondary-color);
  }

  .ask-user__list-text[data-subdued="true"] {
    color: var(--tool-call-secondary-color);
  }
`;

type AskUserQuestionStatus = "answered" | "current" | "pending" | "skipped";

type AskUserResponseState = {
  answers: ElicitationAnswers;
  freeformTexts: ElicitationFreeformTexts;
  currentIndex?: number;
  isFinal: boolean;
};

type AskUserListEntry = {
  id: string;
  text: string;
  status?: AskUserQuestionStatus;
  isSubdued?: boolean;
};

/**
 * Returns the preview text for the collapsed ask_user tool summary.
 */
export function getAskUserToolPreview(part: ToolInvocationPart): string {
  const input = parseElicitToolInput(part.input);
  if (!input) {
    return part.state === "output-error" ? "" : "Question pending";
  }
  const count = input.questions.length;
  return `${count} question${count === 1 ? "" : "s"}`;
}

/**
 * Formats an ask_user tool state into a human-readable label.
 */
export function formatAskUserState(
  state: ToolUIPartState,
  part: ToolInvocationPart
): string {
  const input = parseElicitToolInput(part.input);
  switch (state) {
    case "input-streaming":
      return "Preparing questions";
    case "input-available":
      return input ? "Awaiting response" : "Preparing questions";
    case "output-available":
      return part.output ? "Answered" : "Awaiting response";
    case "output-error":
      return isAskUserCancellation(part) ? "Canceled" : "Error";
    default:
      return formatToolState(state);
  }
}

/**
 * Expanded detail view for an ask_user tool invocation showing the questions
 * and any in-progress or submitted responses in a structured form.
 */
export function AskUserToolDetails({ part }: { part: ToolInvocationPart }) {
  const input = parseElicitToolInput(part.input);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ask_user tool output shape is guaranteed by the tool contract; no runtime schema exists to parse against
  const output = part.output as ElicitToolOutput | null;
  const draft = useElicitationDraft(part.toolCallId);
  const responseState = getAskUserResponseState({ output, draft });

  const questionsText =
    part.state === "output-error"
      ? "Failed to load questions"
      : "Questions pending";
  const questionEntries = input
    ? input.questions.map((question) => ({
        id: question.id,
        text: question.prompt,
      }))
    : [];
  const answerEntries = input
    ? buildAskUserAnswerEntries({
        questions: input.questions,
        responseState,
      })
    : [];

  return (
    <div className="tool-part__body" css={askUserToolDetailsCSS}>
      <ToolPartLabel>Questions</ToolPartLabel>
      {input ? (
        <AskUserListBlock entries={questionEntries} />
      ) : (
        <ToolPartCodeBlock>{questionsText}</ToolPartCodeBlock>
      )}
      {responseState ? (
        <>
          <ToolPartLabel>Answers</ToolPartLabel>
          <AskUserListBlock entries={answerEntries} />
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">
            {isAskUserCancellation(part) ? "Canceled" : "Error"}
          </ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

function isAskUserCancellation(part: ToolInvocationPart) {
  return (
    part.state === "output-error" &&
    part.errorText === ASK_USER_CANCELLED_ERROR_TEXT
  );
}

function AskUserListBlock({ entries }: { entries: AskUserListEntry[] }) {
  return (
    <div className="tool-part__line ask-user__list-block">
      <code className="tool-part__code ask-user__list">
        {entries.map((entry, index) => (
          <span
            key={entry.id}
            className="ask-user__list-line"
            data-status={entry.status}
          >
            <span className="ask-user__list-index">{`${index + 1}. `}</span>
            <span
              className="ask-user__list-text"
              data-subdued={entry.isSubdued ? "true" : undefined}
            >
              {entry.text}
            </span>
          </span>
        ))}
      </code>
    </div>
  );
}

function buildAskUserAnswerEntries({
  questions,
  responseState,
}: {
  questions: ElicitToolInput["questions"];
  responseState: AskUserResponseState | null;
}): AskUserListEntry[] {
  const isFinal = responseState?.isFinal === true;

  return questions.map((question, index) => {
    const rawAnswer = responseState?.answers[question.id];
    const freeformText = responseState?.freeformTexts[question.id];
    const hasAnswer = hasQuestionAnswer(rawAnswer);
    const isCurrent = responseState?.currentIndex === index;
    const status = getQuestionStatus({
      hasAnswer,
      isCurrent,
      isFinal,
    });

    return {
      id: question.id,
      text: getQuestionResponseText({
        question,
        rawAnswer,
        freeformText,
        isFinal,
        isCurrent,
      }),
      status,
      isSubdued:
        status === "skipped" ||
        shouldRenderSubduedAnswerText({
          question,
          rawAnswer,
          freeformText,
        }),
    };
  });
}

function getAskUserResponseState({
  output,
  draft,
}: {
  output: ElicitToolOutput | null;
  draft: {
    answers: ElicitationAnswers;
    freeformTexts: ElicitationFreeformTexts;
    currentIndex: number;
  } | null;
}): AskUserResponseState | null {
  if (output) {
    return {
      answers: output.answers,
      freeformTexts: output.freeformTexts,
      isFinal: true,
    };
  }

  if (draft) {
    return {
      answers: draft.answers,
      freeformTexts: draft.freeformTexts,
      currentIndex: draft.currentIndex,
      isFinal: false,
    };
  }

  return null;
}

function getQuestionStatus({
  hasAnswer,
  isCurrent,
  isFinal,
}: {
  hasAnswer: boolean;
  isCurrent: boolean;
  isFinal: boolean;
}): AskUserQuestionStatus {
  if (hasAnswer) {
    return "answered";
  }
  if (isFinal) {
    return "skipped";
  }
  if (isCurrent) {
    return "current";
  }
  return "pending";
}

function getQuestionResponseText({
  question,
  rawAnswer,
  freeformText,
  isFinal,
  isCurrent,
}: {
  question: ElicitationQuestion;
  rawAnswer: ElicitationAnswers[string] | undefined;
  freeformText: string | undefined;
  isFinal: boolean;
  isCurrent: boolean;
}) {
  if (question.type === "freeform") {
    if (typeof rawAnswer === "string" && rawAnswer.trim()) {
      return rawAnswer;
    }

    return getUnansweredResponseText({
      questionType: question.type,
      isFinal,
      isCurrent,
    });
  }

  if (!Array.isArray(rawAnswer) || rawAnswer.length === 0) {
    return getUnansweredResponseText({
      questionType: question.type,
      isFinal,
      isCurrent,
    });
  }

  const selectedLabels = rawAnswer.map((optionId) => {
    if (optionId === FREEFORM_OPTION_ID) {
      return freeformText?.trim() || "(left blank)";
    }

    return (
      question.options?.find((option) => option.id === optionId)?.label ??
      optionId
    );
  });

  return selectedLabels.join(", ");
}

function getUnansweredResponseText({
  questionType,
  isFinal,
  isCurrent,
}: {
  questionType: ElicitationQuestion["type"];
  isFinal: boolean;
  isCurrent: boolean;
}) {
  if (isFinal) {
    return "Skipped";
  }

  if (!isCurrent) {
    return "Waiting for input";
  }

  return questionType === "freeform"
    ? "No answer yet"
    : "No options selected yet";
}

function hasQuestionAnswer(rawAnswer: ElicitationAnswers[string] | undefined) {
  if (typeof rawAnswer === "string") {
    return rawAnswer.trim().length > 0;
  }

  return Array.isArray(rawAnswer) && rawAnswer.length > 0;
}

function shouldRenderSubduedAnswerText({
  question,
  rawAnswer,
  freeformText,
}: {
  question: ElicitationQuestion;
  rawAnswer: ElicitationAnswers[string] | undefined;
  freeformText: string | undefined;
}) {
  return (
    question.type !== "freeform" &&
    Array.isArray(rawAnswer) &&
    rawAnswer.includes(FREEFORM_OPTION_ID) &&
    !freeformText?.trim()
  );
}
