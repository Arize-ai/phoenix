import { useState } from "react";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Button,
  Flex,
  Input,
  Label,
  NumberField,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import type { ExpectedOutput } from "../calibration";
import type { SlotId, SlotOutput } from "../evaluatorSlotTypes";
import { CalibrationSelect } from "./CalibrationSelect";

/**
 * The expected-output editor shown in the band's popover. Its fields follow
 * the slot's selected output config: a choice of that output's labels (with
 * the label's configured score) for a categorical output, otherwise a score
 * within the output's bounds and a free label.
 */
export function ExpectedOutputForm({
  slot,
  expected,
  output,
  isDisabled,
  onSave,
  onClose,
}: {
  slot: SlotId;
  expected?: ExpectedOutput;
  output?: SlotOutput;
  isDisabled: boolean;
  onSave: (output: ExpectedOutput | null) => Promise<UIOperationResult>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(expected?.label ?? "");
  const [score, setScore] = useState<number | null>(expected?.score ?? null);
  const [explanation, setExplanation] = useState(expected?.explanation ?? "");
  const draft = getExpectedDraft({ label, score, output });

  async function save(next: ExpectedOutput | null) {
    const result = await onSave(next);

    if (result.ok) onClose();
  }

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-200">
        <Text weight="heavy">Expected output · {slot}</Text>
        {draft.isCategorical ? (
          <CategoricalExpectedFields
            labels={output?.labels ?? []}
            label={label}
            score={draft.score}
            onChange={setLabel}
          />
        ) : (
          <ScoredExpectedFields
            output={output}
            label={label}
            score={score}
            isScoreInBounds={draft.isScoreInBounds}
            onLabelChange={setLabel}
            onScoreChange={setScore}
          />
        )}
        <TextField value={explanation} onChange={setExplanation}>
          <Label>Explanation</Label>
          <Input placeholder="Optional" />
        </TextField>
        <Flex direction="row" justifyContent="end" gap="size-100">
          {expected ? (
            <Button
              size="S"
              variant="default"
              isDisabled={isDisabled}
              onPress={() => void save(null)}
            >
              Clear
            </Button>
          ) : null}
          <Button
            size="S"
            variant="primary"
            isDisabled={isDisabled || !draft.hasValue || !draft.isScoreInBounds}
            onPress={() =>
              void save({
                label: label.trim() || null,
                score: draft.score,
                explanation: explanation.trim() || null,
              })
            }
          >
            Save expected
          </Button>
        </Flex>
      </Flex>
    </View>
  );
}

/**
 * What the form would save, and whether it may: a categorical output takes
 * the chosen label's configured score, anything else the typed score as long
 * as it sits within the output's bounds.
 */
function getExpectedDraft({
  label,
  score,
  output,
}: {
  label: string;
  score: number | null;
  output?: SlotOutput;
}) {
  const labels = output?.labels ?? [];
  const isCategorical = labels.length > 0;

  if (isCategorical)
    return {
      isCategorical,
      score: output?.labelScores[label] ?? null,
      hasValue: labels.includes(label),
      isScoreInBounds: true,
    };

  const isScoreInBounds =
    score == null ||
    ((output?.lowerBound == null || score >= output.lowerBound) &&
      (output?.upperBound == null || score <= output.upperBound));

  return {
    isCategorical,
    score,
    hasValue: label.trim() !== "" || score != null,
    isScoreInBounds,
  };
}

/** Pick one of the output's labels; its score comes from the config. */
function CategoricalExpectedFields({
  labels,
  label,
  score,
  onChange,
}: {
  labels: string[];
  label: string;
  score: number | null;
  onChange: (label: string) => void;
}) {
  return (
    <Flex direction="column" gap="size-50">
      <CalibrationSelect
        label="Label"
        value={label}
        options={labels.map((name) => ({ id: name, name }))}
        onChange={onChange}
      />
      {score != null ? (
        <Text size="XS" color="text-500">
          Scores {floatFormatter(score)} in this output config.
        </Text>
      ) : null}
    </Flex>
  );
}

/** A score within the output's bounds, and an optional free label. */
function ScoredExpectedFields({
  output,
  label,
  score,
  isScoreInBounds,
  onLabelChange,
  onScoreChange,
}: {
  output?: SlotOutput;
  label: string;
  score: number | null;
  isScoreInBounds: boolean;
  onLabelChange: (label: string) => void;
  onScoreChange: (score: number | null) => void;
}) {
  const hasBounds = output?.lowerBound != null || output?.upperBound != null;

  return (
    <>
      <NumberField
        value={score ?? NaN}
        onChange={(next) => onScoreChange(Number.isNaN(next) ? null : next)}
        minValue={output?.lowerBound ?? undefined}
        maxValue={output?.upperBound ?? undefined}
        isInvalid={!isScoreInBounds}
      >
        <Label>Score</Label>
        <Input placeholder="Optional" />
        {hasBounds ? (
          <Text slot="description">
            from {output?.lowerBound ?? "−∞"} to {output?.upperBound ?? "∞"}
          </Text>
        ) : null}
      </NumberField>
      <TextField value={label} onChange={onLabelChange}>
        <Label>Label</Label>
        <Input placeholder="Optional" />
      </TextField>
    </>
  );
}
