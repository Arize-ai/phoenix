import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Alert,
  Button,
  Dialog,
  Flex,
  Form,
  Input,
  Label,
  Modal,
  ModalOverlay,
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

import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";

type SaveAction = EvaluatorSaveTarget["action"];

/** What Save does to the task's evaluator, by save target. */
export const SAVE_EFFECTS: Record<SaveAction, string> = {
  create: "Creates a new evaluator with this name and adds it to the dataset",
  attach:
    "Updates this code evaluator wherever it is used and adds it to the dataset under this name",
  update: "Updates this evaluator on the dataset",
};

const SUBMIT_LABELS: Record<SaveAction, string> = {
  create: "Create evaluator",
  attach: "Add to dataset",
  update: "Update evaluator",
};

/**
 * The task's save step, in the shape of the prompt playground's save dialog:
 * name and description (the same values the Output tab edits), what the save
 * will do, and, for a loaded evaluator, a "Save as new" that leaves it
 * untouched and saves a new evaluator under the typed name, or as a copy
 * named `<name>_copy` when the name was not changed.
 */
export function SaveEvaluatorTaskDialog({
  target,
  savedNames,
  isOpen,
  onOpenChange,
  isSaving,
  error,
  onSave,
}: {
  target: EvaluatorSaveTarget;
  /** The names the loaded evaluator is saved under; see "Save as new". */
  savedNames: readonly string[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isSaving: boolean;
  error: string | null;
  onSave: (options: { asNew: boolean }) => Promise<UIOperationResult>;
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog>
          <SaveEvaluatorTaskForm
            target={target}
            savedNames={savedNames}
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

function SaveEvaluatorTaskForm({
  target,
  savedNames,
  isSaving,
  error,
  onSave,
  onClose,
}: {
  target: EvaluatorSaveTarget;
  savedNames: readonly string[];
  isSaving: boolean;
  error: string | null;
  onSave: (options: { asNew: boolean }) => Promise<UIOperationResult>;
  onClose: () => void;
}) {
  const name = useEvaluatorStore((state) => state.evaluator.globalName);
  const description = useEvaluatorStore((state) => state.evaluator.description);
  const setName = useEvaluatorStore((state) => state.setEvaluatorGlobalName);

  const setDescription = useEvaluatorStore(
    (state) => state.setEvaluatorDescription
  );

  const canSubmit = !!name.trim() && !isSaving;
  // "Save as new" under the loaded evaluator's own name saves a copy; under
  // a new name it saves the evaluator the name describes.
  const isCopy = savedNames.includes(name.trim());

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Save evaluator</DialogTitle>
      </DialogHeader>
      <Form
        onSubmit={(event) => {
          event.preventDefault();

          if (canSubmit) void onSave({ asNew: false });
        }}
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <Text color="text-700">{SAVE_EFFECTS[target.action]}.</Text>
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
                The same name shown in the task&apos;s Output tab.
              </Text>
            </TextField>
            <TextField value={description} onChange={setDescription} size="S">
              <Label>Description (optional)</Label>
              <TextArea />
            </TextField>
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
                onPress={() => void onSave({ asNew: true })}
              >
                Save as new
              </Button>
              <Tooltip>
                <TooltipArrow />
                {isCopy
                  ? `Leaves the loaded evaluator unchanged and creates a copy named ${name.trim()}_copy. Rename it afterwards if you like.`
                  : `Leaves the loaded evaluator unchanged and creates a new evaluator named ${name.trim()}.`}
              </Tooltip>
            </TooltipTrigger>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            isDisabled={!canSubmit}
            isPending={isSaving}
          >
            {SUBMIT_LABELS[target.action]}
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  );
}
