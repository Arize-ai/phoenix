import { useState } from "react";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Form,
  Input,
  Label,
  Modal,
  ModalOverlay,
  NumberField,
  Text,
  TextArea,
  TextField,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { toProjectEvaluatorSamplingFraction } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

import type { EvaluatorSlotSource } from "./evaluatorPlaygroundSource";
import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";
import type { EvaluatorSlotSaveOptions, SlotId } from "./evaluatorSlotTypes";

type SaveAction = EvaluatorSaveTarget["action"];
type SourceKind = EvaluatorSlotSource["kind"];

/** What Save does to the slot's evaluator, by source kind and save target. */
export const SAVE_EFFECTS: Record<SourceKind, Record<SaveAction, string>> = {
  dataset: {
    create: "Creates a new evaluator with this name and adds it to the dataset",
    attach:
      "Updates this code evaluator wherever it is used and adds it to the dataset under this name",
    update: "Updates this evaluator on the dataset",
  },
  project: {
    create:
      "Creates a new evaluator with this name and adds it to the project as an online span evaluator",
    attach:
      "Updates this code evaluator wherever it is used and adds it to the project under this name as an online span evaluator",
    update: "Updates this online evaluator on the project",
  },
};

const SUBMIT_LABELS: Record<SourceKind, Record<SaveAction, string>> = {
  dataset: {
    create: "Create evaluator",
    attach: "Add to dataset",
    update: "Update evaluator",
  },
  project: {
    create: "Create evaluator",
    attach: "Add to project",
    update: "Update evaluator",
  },
};

/** The project evaluator's stored scope, when the slot loaded one. */
export type ProjectEvaluatorScopeDefaults = {
  filterCondition: string;
  /** A fraction in [0, 1]. */
  samplingRate: number;
};

/**
 * The slot's save step, in the shape of the prompt playground's save dialog:
 * name and description (the same values the Output tab edits), what the save
 * will do, and, for a loaded evaluator, a "Save as new" that leaves it
 * untouched and saves a copy named `<name>_copy`. On a project source it also
 * sets what the online evaluator runs on: the current filter and a sampling rate.
 */
export function SaveEvaluatorSlotDialog({
  slotId,
  target,
  source,
  sourceFilterCondition,
  projectScope,
  isOpen,
  onOpenChange,
  isSaving,
  error,
  onSave,
}: {
  slotId: SlotId;
  target: EvaluatorSaveTarget;
  source: EvaluatorSlotSource;
  /** The applied filter in the Results strip, offered for a project save. */
  sourceFilterCondition: string;
  /** The loaded project evaluator's scope; null for a new draft. */
  projectScope: ProjectEvaluatorScopeDefaults | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isSaving: boolean;
  error: string | null;
  onSave: (options: EvaluatorSlotSaveOptions) => Promise<UIOperationResult>;
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog>
          <SaveEvaluatorSlotForm
            slotId={slotId}
            target={target}
            source={source}
            sourceFilterCondition={sourceFilterCondition}
            projectScope={projectScope}
            isSaving={isSaving}
            error={error}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function SaveEvaluatorSlotForm({
  slotId,
  target,
  source,
  sourceFilterCondition,
  projectScope,
  isSaving,
  error,
  onSave,
  onClose,
}: {
  slotId: SlotId;
  target: EvaluatorSaveTarget;
  source: EvaluatorSlotSource;
  sourceFilterCondition: string;
  projectScope: ProjectEvaluatorScopeDefaults | null;
  isSaving: boolean;
  error: string | null;
  onSave: (options: EvaluatorSlotSaveOptions) => Promise<UIOperationResult>;
  onClose: () => void;
}) {
  const name = useEvaluatorStore((state) => state.evaluator.globalName);
  const description = useEvaluatorStore((state) => state.evaluator.description);
  const setName = useEvaluatorStore((state) => state.setEvaluatorGlobalName);
  const setDescription = useEvaluatorStore(
    (state) => state.setEvaluatorDescription
  );

  // Checked by default when there is a filter to include; unchecked, an update
  // keeps the evaluator's stored filter and a create stores none.
  const [includeFilter, setIncludeFilter] = useState(
    sourceFilterCondition.trim().length > 0
  );

  const [samplingPercent, setSamplingPercent] = useState(
    projectScope ? Math.round(projectScope.samplingRate * 100) : 100
  );

  const canSubmit = !!name.trim() && !isSaving;

  const projectOptions: EvaluatorSlotSaveOptions =
    source.kind === "project"
      ? {
          filterCondition: includeFilter
            ? sourceFilterCondition
            : (projectScope?.filterCondition ?? ""),
          samplingRate: toProjectEvaluatorSamplingFraction(samplingPercent),
        }
      : {};

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Save evaluator {slotId}</DialogTitle>
      </DialogHeader>
      <Form
        onSubmit={(event) => {
          event.preventDefault();

          if (canSubmit) void onSave({ ...projectOptions, asNew: false });
        }}
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <Text color="text-700">
              {SAVE_EFFECTS[source.kind][target.action]}.
            </Text>
            {error ? (
              <Alert variant="danger" title="Could not save evaluator">
                {error}
              </Alert>
            ) : null}
            <TextField
              isRequired
              value={name}
              onChange={setName}
              size="S"
              autoFocus
            >
              <Label>Name</Label>
              <Input placeholder="e.g. correctness" />
              <Text slot="description">
                The same name shown in the slot&apos;s Output tab.
              </Text>
            </TextField>
            <TextField value={description} onChange={setDescription} size="S">
              <Label>Description (optional)</Label>
              <TextArea />
            </TextField>
            {source.kind === "project" ? (
              <ProjectScopeFields
                sourceFilterCondition={sourceFilterCondition}
                includeFilter={includeFilter}
                onIncludeFilterChange={setIncludeFilter}
                samplingPercent={samplingPercent}
                onSamplingPercentChange={setSamplingPercent}
              />
            ) : null}
          </Flex>
        </View>
        <DialogFooter>
          <Button variant="default" onPress={onClose} isDisabled={isSaving}>
            Cancel
          </Button>
          {target.action !== "create" ? (
            <TooltipTrigger>
              <Button
                variant="default"
                isDisabled={!canSubmit}
                onPress={() => void onSave({ ...projectOptions, asNew: true })}
              >
                Save as new
              </Button>
              <Tooltip>
                <TooltipArrow />
                Leaves the loaded evaluator unchanged and creates a copy named{" "}
                {name.trim()}_copy. Rename it afterwards if you like.
              </Tooltip>
            </TooltipTrigger>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            isDisabled={!canSubmit}
            isPending={isSaving}
          >
            {SUBMIT_LABELS[source.kind][target.action]}
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  );
}

/** What the saved online evaluator runs on. The target is fixed to spans. */
function ProjectScopeFields({
  sourceFilterCondition,
  includeFilter,
  onIncludeFilterChange,
  samplingPercent,
  onSamplingPercentChange,
}: {
  sourceFilterCondition: string;
  includeFilter: boolean;
  onIncludeFilterChange: (include: boolean) => void;
  samplingPercent: number;
  onSamplingPercentChange: (percent: number) => void;
}) {
  const hasFilter = sourceFilterCondition.trim().length > 0;

  return (
    <>
      <Flex direction="column" gap="size-50">
        <Text size="XS" weight="heavy" color="text-700">
          Evaluation target
        </Text>
        <Text size="S">Span</Text>
      </Flex>
      <Flex direction="column" gap="size-50">
        <Checkbox
          isSelected={includeFilter}
          isDisabled={!hasFilter}
          onChange={onIncludeFilterChange}
        >
          Include the current filter condition
        </Checkbox>
        <Text
          size="XS"
          color="text-500"
          fontFamily={hasFilter ? "mono" : undefined}
        >
          {hasFilter
            ? sourceFilterCondition
            : "The Results strip has no filter; the evaluator runs on every span."}
        </Text>
      </Flex>
      <NumberField
        size="S"
        value={samplingPercent}
        minValue={0}
        maxValue={100}
        step={1}
        formatOptions={{
          style: "unit",
          unit: "percent",
          unitDisplay: "narrow",
        }}
        onChange={(value) => {
          if (Number.isFinite(value)) onSamplingPercentChange(value);
        }}
      >
        <Label>Sampling rate</Label>
        <Input />
        <Text slot="description">
          The share of matching spans the online evaluator runs on.
        </Text>
      </NumberField>
    </>
  );
}
