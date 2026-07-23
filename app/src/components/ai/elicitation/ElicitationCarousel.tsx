import { AnimatePresence, motion } from "motion/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { FocusScope } from "react-aria";

import type {
  ElicitationAnswers,
  ElicitationFreeformTexts,
} from "@phoenix/agent/tools/elicit";
import { Button } from "@phoenix/components/core/button";

import { ElicitationOptionButton } from "./ElicitationOptionButton";
import { elicitationCarouselCSS } from "./styles";
import type { ElicitationCarouselProps, ElicitationDraftState } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sentinel option ID for the auto-generated "Type your own answer" option. */
const FREEFORM_OPTION_ID = "__freeform__";

/**
 * Narrow an answer value to the selected option IDs for single/multi
 * questions. Freeform (string) or missing answers yield an empty list.
 */
function getSelectedOptionIds(
  answer: ElicitationAnswers[string] | undefined
): string[] {
  return Array.isArray(answer) ? answer : [];
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const STAGGER = 0.04;

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 120 : -120, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -120 : 120, opacity: 0 }),
};

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 32,
  mass: 0.8,
};

const entrySpring = {
  type: "spring" as const,
  stiffness: 700,
  damping: 24,
  mass: 0.6,
};

// ---------------------------------------------------------------------------
// ElicitationCarousel
// ---------------------------------------------------------------------------

/**
 * Paginated question carousel for the `ask_user` tool.
 *
 * Shows one question at a time with animated slide transitions, dot pagination,
 * and Back / Next / Submit navigation. Supports `single`, `multi`, and
 * `freeform` question types, with optional `allow_freeform` inline text entry.
 *
 * @example
 * ```tsx
 * <ElicitationCarousel questions={questions} onSubmit={handleSubmit} />
 * ```
 */
export function ElicitationCarousel({
  questions,
  onProgressStateChange,
  onSubmit,
  onCancel,
}: ElicitationCarouselProps) {
  const [answers, setAnswers] = useState<ElicitationAnswers>({});
  const [freeformTexts, setFreeformTexts] = useState<ElicitationFreeformTexts>(
    {}
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const isInitialMount = useRef(true);

  const emitProgressState = useEffectEvent(
    (progressState: ElicitationDraftState) => {
      onProgressStateChange?.(progressState);
    }
  );

  const total = questions.length;
  const question = questions[currentIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialMount.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    emitProgressState({ answers: {}, freeformTexts: {}, currentIndex: 0 });
  }, []);

  const goTo = (idx: number) => {
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
    onProgressStateChange?.({ answers, freeformTexts, currentIndex: idx });
  };

  const toggleOption = (
    questionId: string,
    optionId: string,
    type: "single" | "multi"
  ) => {
    const current = getSelectedOptionIds(answers[questionId]);
    let next: string[];
    if (type === "single") {
      next = current.includes(optionId) ? [] : [optionId];
    } else {
      next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
    }
    setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: next }));
  };

  const setFreeformAnswer = (questionId: string, value: string) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: value,
    }));
  };

  const handleSubmit = () => {
    onProgressStateChange?.({ answers, freeformTexts, currentIndex });
    onSubmit({ answers, freeformTexts });
  };

  /**
   * Advance the carousel: submit if on the last question, otherwise go next.
   * No-op if the current question cannot be advanced (no answer and no skip).
   */
  const advanceOrSubmit = () => {
    const currentQuestionAnswers = answers[questions[currentIndex].id];
    const currentHasAnswer = Array.isArray(currentQuestionAnswers)
      ? currentQuestionAnswers.length > 0
      : !!currentQuestionAnswers;
    const currentCanAdvance =
      currentHasAnswer || questions[currentIndex].allow_skip === true;
    if (!currentCanAdvance) {
      return;
    }
    if (currentIndex === total - 1) {
      handleSubmit();
    } else {
      goTo(currentIndex + 1);
    }
  };

  /**
   * Container-level keyboard shortcuts:
   * - Cmd/Ctrl+Enter advances or submits from anywhere in the carousel
   *   (including focused option buttons and inline text inputs).
   * - Plain Enter from a single-line text input (the inline freeform option
   *   entry) also advances or submits.
   * The freeform `<textarea>` handles Enter via its own onKeyDown, so it is not
   * handled here.
   * IME-safe via the `isComposing` guard.
   */
  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) {
      return;
    }
    const target = e.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const isTextarea = target.tagName === "TEXTAREA";
    if (isTextarea) {
      return;
    }
    const isSingleLineInput =
      target instanceof HTMLInputElement && target.type === "text";
    if (e.metaKey || e.ctrlKey || isSingleLineInput) {
      e.preventDefault();
      advanceOrSubmit();
    }
  };

  /**
   * Freeform textarea keyboard handling:
   * - Enter advances/submits
   * - Shift+Enter inserts a newline (default behavior)
   * - Cmd/Ctrl+Enter also advances/submits
   * - IME-safe via the `isComposing` guard
   */
  const handleFreeformKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) {
      return;
    }
    if (e.shiftKey) {
      return;
    }
    e.preventDefault();
    advanceOrSubmit();
  };

  // Stagger delays for entry animation
  const stagger = isInitialMount.current ? STAGGER : 0;
  const headerDelay = stagger;
  const promptDelay = 2 * stagger;
  const optionDelay = (i: number) => (3 + i) * stagger;
  const freeformDelay = 3 * stagger;
  const navDelay = 0;

  const currentAnswers = answers[question.id];
  const hasAnswer = Array.isArray(currentAnswers)
    ? currentAnswers.length > 0
    : !!currentAnswers;

  // Narrowed selection mode: null for freeform questions, otherwise the
  // single/multi mode. Stored in a const so the narrowing survives closures.
  const selectionType = question.type === "freeform" ? null : question.type;
  const freeformAnswerText =
    typeof currentAnswers === "string" ? currentAnswers : "";
  const selectedOptionIds = getSelectedOptionIds(currentAnswers);

  const canSkip = question.allow_skip === true;
  const canAdvance = hasAnswer || canSkip;

  return (
    <FocusScope autoFocus contain restoreFocus>
      <div css={elicitationCarouselCSS} onKeyDown={handleContainerKeyDown}>
        {/* Header with step indicator and dots */}
        <motion.div
          className="elicitation__header"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...entrySpring,
            delay: headerDelay,
            opacity: { duration: 0.12, delay: headerDelay },
          }}
        >
          <span className="elicitation__step-label">
            Question {currentIndex + 1} of {total}
          </span>
          <div className="elicitation__dots">
            {questions.map((_, i) => (
              <button
                key={i}
                className={`elicitation__dot ${
                  i === currentIndex
                    ? "elicitation__dot--active"
                    : "elicitation__dot--inactive"
                }`}
                onClick={() => goTo(i)}
                aria-label={`Go to question ${i + 1}`}
              />
            ))}
          </div>
        </motion.div>

        {/* Question carousel */}
        <div className="elicitation__body">
          <AnimatePresence custom={direction} mode="popLayout">
            <motion.div
              key={question.id}
              custom={direction}
              variants={slideVariants}
              initial={isInitialMount.current ? false : "enter"}
              animate="center"
              exit="exit"
              transition={springTransition}
              className="elicitation__question-content"
            >
              {/* Question prompt */}
              <motion.div
                className="elicitation__prompt"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...entrySpring,
                  delay: promptDelay,
                  opacity: { duration: 0.12, delay: promptDelay },
                }}
              >
                {question.prompt}
              </motion.div>

              {/* Freeform textarea */}
              {selectionType === null ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...entrySpring,
                    delay: freeformDelay,
                    opacity: { duration: 0.12, delay: freeformDelay },
                  }}
                >
                  <textarea
                    className="elicitation__freeform"
                    value={freeformAnswerText}
                    onChange={(e) =>
                      setFreeformAnswer(question.id, e.target.value)
                    }
                    onKeyDown={handleFreeformKeyDown}
                    placeholder="Type your response… (Enter to submit, Shift+Enter for newline)"
                    aria-label={question.prompt}
                  />
                </motion.div>
              ) : (
                /* Options list */
                <div className="elicitation__options">
                  {question.options?.map((opt, i) => (
                    <motion.div
                      key={opt.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...entrySpring,
                        delay: optionDelay(i),
                        opacity: { duration: 0.12, delay: optionDelay(i) },
                      }}
                    >
                      <ElicitationOptionButton
                        selected={selectedOptionIds.includes(opt.id)}
                        type={selectionType}
                        label={opt.label}
                        description={opt.description}
                        onToggle={() =>
                          toggleOption(question.id, opt.id, selectionType)
                        }
                      />
                    </motion.div>
                  ))}
                  {/* Auto-generated freeform entry option */}
                  {question.allow_freeform ? (
                    <motion.div
                      key={FREEFORM_OPTION_ID}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...entrySpring,
                        delay: optionDelay(question.options?.length ?? 0),
                        opacity: {
                          duration: 0.12,
                          delay: optionDelay(question.options?.length ?? 0),
                        },
                      }}
                    >
                      <ElicitationOptionButton
                        selected={selectedOptionIds.includes(
                          FREEFORM_OPTION_ID
                        )}
                        type={selectionType}
                        label="Type your own answer"
                        isFreeformEntry
                        textValue={freeformTexts[question.id]}
                        onToggle={() =>
                          toggleOption(
                            question.id,
                            FREEFORM_OPTION_ID,
                            selectionType
                          )
                        }
                        onTextChange={(v) =>
                          setFreeformTexts((currentFreeformTexts) => ({
                            ...currentFreeformTexts,
                            [question.id]: v,
                          }))
                        }
                      />
                    </motion.div>
                  ) : null}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <motion.div
          className="elicitation__nav"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...entrySpring,
            delay: navDelay,
            opacity: { duration: 0.12, delay: navDelay },
          }}
        >
          <div className="elicitation__nav-group">
            {onCancel && (
              <Button size="S" variant="default" onPress={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              size="S"
              variant="default"
              isDisabled={currentIndex === 0}
              onPress={() => goTo(currentIndex - 1)}
            >
              Back
            </Button>
          </div>

          {currentIndex === total - 1 ? (
            <Button
              size="S"
              variant="primary"
              isDisabled={!canAdvance}
              onPress={handleSubmit}
            >
              Submit
            </Button>
          ) : (
            <Button
              size="S"
              variant={hasAnswer ? "primary" : "default"}
              isDisabled={!canAdvance}
              onPress={() => goTo(currentIndex + 1)}
            >
              {hasAnswer ? "Next" : "Skip"}
            </Button>
          )}
        </motion.div>
      </div>
    </FocusScope>
  );
}
