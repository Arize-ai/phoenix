import { useSearchParams } from "react-router";

import {
  Alert,
  Button,
  Card,
  ComboBox,
  ComboBoxItem,
  Flex,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import {
  DEFAULT_CHOICE_CRITERIA,
  DEFAULT_NOUL_CRITERIA,
  DEFAULT_SCORE_CRITERIA,
} from "@phoenix/constants/decisionConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import {
  createDecisionDraft,
  getDecisionValidationError,
  type DecisionDraft,
  type DecisionQuestionDraft,
} from "./decisionUtils";
import type { PlaygroundInstanceProps } from "./types";

/** State and typed questions replace chat messages for decision models. */
export function PlaygroundDecisionTemplate({
  playgroundInstanceId,
}: PlaygroundInstanceProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((item) => item.id === playgroundInstanceId)
  );
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const [, setSearchParams] = useSearchParams();
  if (!instance) return null;
  const draft = instance.decision ?? createDecisionDraft();
  const isRunning = instance.activeRunId != null;
  const error = getDecisionValidationError(draft);
  function updateDraft(patch: Partial<DecisionDraft>) {
    updateInstance({
      instanceId: playgroundInstanceId,
      dirty: true,
      patch: { decision: { ...draft, ...patch } },
    });
  }
  function updateQuestion({
    id,
    patch,
  }: {
    id: string;
    patch: Partial<DecisionQuestionDraft>;
  }) {
    updateDraft({
      questions: draft.questions.map((question) =>
        question.id === id ? { ...question, ...patch } : question
      ),
    });
  }
  return (
    <Flex direction="column" gap="size-200">
      <Text color="text-700">
        Evaluate state with named questions. Decision models return typed
        answers, not a conversation.
      </Text>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Flex direction="row" gap="size-200">
        <TextField
          value={instance.model.modelName ?? ""}
          onChange={(modelName) => {
            updateInstance({
              instanceId: playgroundInstanceId,
              dirty: true,
              patch: { model: { ...instance.model, modelName } },
            });
            setSearchParams(
              (params) => {
                params.set("decisionModel", modelName);
                return params;
              },
              { replace: true }
            );
          }}
          isDisabled={isRunning}
        >
          <Label>Decision model</Label>
          <Input />
        </TextField>
        <TextField
          value={instance.model.baseUrl ?? ""}
          onChange={(baseUrl) =>
            updateInstance({
              instanceId: playgroundInstanceId,
              dirty: true,
              patch: { model: { ...instance.model, baseUrl: baseUrl || null } },
            })
          }
          isDisabled={isRunning}
        >
          <Label>Base URL (optional)</Label>
          <Input placeholder="Provider default, or a compatible endpoint" />
        </TextField>
      </Flex>
      <ComboBox
        label="State format"
        selectedKey={draft.stateFormat}
        onSelectionChange={(key) =>
          updateDraft({ stateFormat: key === "json" ? "json" : "text" })
        }
        isDisabled={isRunning}
      >
        <ComboBoxItem id="text" textValue="Text">
          Text
        </ComboBoxItem>
        <ComboBoxItem id="json" textValue="JSON">
          JSON
        </ComboBoxItem>
      </ComboBox>
      <TextField
        value={draft.state}
        onChange={(state) => updateDraft({ state })}
        isDisabled={isRunning}
      >
        <Label>State</Label>
        <TextArea rows={4} />
      </TextField>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {draft.questions.map((question, index) => (
          <li key={question.id}>
            <View paddingBottom="size-200">
              <Card
                title={`Question ${index + 1}`}
                extra={
                  <Button
                    size="S"
                    isDisabled={isRunning || draft.questions.length === 1}
                    onPress={() =>
                      updateDraft({
                        questions: draft.questions.filter(
                          (item) => item.id !== question.id
                        ),
                      })
                    }
                  >
                    Remove question {index + 1}
                  </Button>
                }
              >
                <View padding="size-200">
                  <Flex direction="column" gap="size-100">
                    <Flex direction="row" gap="size-200">
                      <TextField
                        value={question.name}
                        onChange={(name) =>
                          updateQuestion({ id: question.id, patch: { name } })
                        }
                        isDisabled={isRunning}
                      >
                        <Label>Question name</Label>
                        <Input />
                      </TextField>
                      <ComboBox
                        label="Question type"
                        selectedKey={question.type}
                        onSelectionChange={(key) => {
                          if (
                            key !== "choice" &&
                            key !== "noul" &&
                            key !== "score"
                          )
                            return;
                          updateQuestion({
                            id: question.id,
                            patch: {
                              type: key,
                              criteria:
                                key === "choice"
                                  ? DEFAULT_CHOICE_CRITERIA
                                  : key === "score"
                                    ? DEFAULT_SCORE_CRITERIA
                                    : DEFAULT_NOUL_CRITERIA,
                            },
                          });
                        }}
                        isDisabled={isRunning}
                      >
                        <ComboBoxItem id="choice" textValue="Choice">
                          Choice
                        </ComboBoxItem>
                        <ComboBoxItem id="noul" textValue="Noul / Predicate">
                          Noul / Predicate
                        </ComboBoxItem>
                        <ComboBoxItem id="score" textValue="Score">
                          Score
                        </ComboBoxItem>
                      </ComboBox>
                    </Flex>
                    <TextField
                      value={question.instructions}
                      onChange={(instructions) =>
                        updateQuestion({
                          id: question.id,
                          patch: { instructions },
                        })
                      }
                      isDisabled={isRunning}
                    >
                      <Label>Instructions</Label>
                      <TextArea rows={2} />
                    </TextField>
                    <TextField
                      value={question.criteria}
                      onChange={(criteria) =>
                        updateQuestion({ id: question.id, patch: { criteria } })
                      }
                      isDisabled={isRunning}
                    >
                      <Label>
                        {question.type === "choice"
                          ? "Choices (JSON object)"
                          : question.type === "score"
                            ? "Score levels (JSON array)"
                            : "True / false criteria (optional JSON object)"}
                      </Label>
                      <TextArea rows={4} />
                    </TextField>
                    <Text size="S" color="text-700">
                      {question.type === "choice"
                        ? "Map each option to a description, or null for an undescribed option."
                        : question.type === "score"
                          ? "Ordered rubric from lowest to highest. Scores are probability-weighted averages of zero-based level indices."
                          : "Returns the probability that the condition is true. OpenAI calls this a Predicate."}
                    </Text>
                  </Flex>
                </View>
              </Card>
            </View>
          </li>
        ))}
      </ul>
      <Button
        size="S"
        isDisabled={isRunning || draft.questions.length >= 255}
        onPress={() => {
          let suffix = draft.questions.length + 1;
          while (
            draft.questions.some(
              (question) => question.name === `question_${suffix}`
            )
          )
            suffix += 1;
          updateDraft({
            questions: [
              ...draft.questions,
              {
                id: crypto.randomUUID(),
                name: `question_${suffix}`,
                type: "noul",
                instructions: "Is this request urgent?",
                criteria: "",
              },
            ],
          });
        }}
      >
        Add question
      </Button>
    </Flex>
  );
}
