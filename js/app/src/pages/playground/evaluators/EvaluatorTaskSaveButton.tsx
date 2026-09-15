import { useState } from "react";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import { Button, Icon, Icons } from "@phoenix/components";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { DisabledButtonTooltip } from "@phoenix/pages/playground/DisabledButtonTooltip";
import type { PlaygroundEvaluatorTaskCode } from "@phoenix/store/playground";
import { getPlaygroundEvaluatorTask } from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import {
  getEvaluatorTaskName,
  getEvaluatorTaskPreview,
  getEvaluatorTaskRevision,
} from "./evaluatorTaskSnapshot";
import { SaveEvaluatorTaskDialog } from "./SaveEvaluatorTaskDialog";
import { useEvaluatorTaskSave } from "./useEvaluatorTaskSave";
import { useEvaluatorTaskSaveTarget } from "./useEvaluatorTaskSaveTarget";

const NAME_REQUIRED_ERROR = "Enter a name before saving.";

/**
 * Save for an evaluator task: the button, the dialog, and the write. Saving
 * needs the dataset the evaluator is saved onto, so without one the button
 * says so instead of opening the dialog.
 */
export function EvaluatorTaskSaveButton({
  instanceId,
  datasetId,
  code,
  loadedSandboxConfigId,
  validationError,
  onNameRequired,
  onSaved,
}: {
  instanceId: number;
  datasetId: string | null;
  code: PlaygroundEvaluatorTaskCode;
  /** The sandbox the task was loaded with; a save rebinds only on change. */
  loadedSandboxConfigId: string | null;
  validationError: string | null;
  /** The name lives on the Output tab; a save without one goes there. */
  onNameRequired: () => void;
  /** The sandbox the save bound, which the next save diffs against. */
  onSaved: (sandboxConfigId: string | null) => void;
}) {
  const playgroundStore = usePlaygroundStore();
  const store = useEvaluatorStoreInstance();
  const evaluator = usePlaygroundContext((state) =>
    getPlaygroundEvaluatorTask(selectPlaygroundInstance(instanceId)(state))
  );
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );
  if (!evaluator) {
    throw new Error(`Playground instance ${instanceId} is not an evaluator`);
  }
  const saveTarget = useEvaluatorTaskSaveTarget({
    source: evaluator.source,
    datasetId,
  });
  const { save: saveTask, copyName, isSaving } = useEvaluatorTaskSave();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Saves the draft to `saveTarget`, or as a new evaluator named as a copy of
   * the draft when the dialog's "Save as new" asks for one.
   */
  async function save({
    asNew = false,
  }: { asNew?: boolean } = {}): Promise<UIOperationResult> {
    setSaveError(null);
    const state = playgroundStore.getState();
    const instance = selectPlaygroundInstance(instanceId)(state);
    const current = getPlaygroundEvaluatorTask(instance);
    if (
      !datasetId ||
      !instance ||
      !current ||
      !(await store.getState().validateAll())
    ) {
      return {
        ok: false,
        error: "Select a dataset and complete evaluator setup before saving.",
      };
    }
    const draftName = store.getState().evaluator.globalName.trim();
    if (!draftName) {
      setSaveError(NAME_REQUIRED_ERROR);
      onNameRequired();
      return { ok: false, error: NAME_REQUIRED_ERROR };
    }

    try {
      // The copy's name lands in the draft too, so the task shows what was
      // saved and the user can rename it afterwards.
      const name = asNew ? await copyName(draftName, datasetId) : draftName;
      if (asNew) store.getState().setEvaluatorGlobalName(name);
      const saved = await saveTask({
        target: asNew ? { action: "create" } : saveTarget,
        datasetId,
        name,
        description: current.description.trim() || undefined,
        preview: getEvaluatorTaskPreview({
          evaluator: current,
          name: getEvaluatorTaskName({ name }, index),
          playgroundStore,
          instanceId,
          datasetId,
        }),
        inputMapping: current.inputMapping,
        promptVersionId: instance.prompt?.version ?? null,
        sandboxConfigId: code.sandboxConfigId,
        initialSandboxConfigId: loadedSandboxConfigId,
      });
      onSaved(code.sandboxConfigId);

      // The task now stands for what was saved: the next save updates it,
      // and the judge prompt diffs against the version the save produced.
      const latest = getPlaygroundEvaluatorTask(
        selectPlaygroundInstance(instanceId)(playgroundStore.getState())
      );
      if (latest) {
        const savedEvaluator = {
          ...latest,
          name,
          source: {
            evaluatorId: saved.evaluatorId,
            datasetEvaluatorId: saved.datasetEvaluatorId,
          },
        };
        playgroundStore.getState().updateInstance({
          instanceId,
          patch: {
            task: {
              kind: "evaluator",
              evaluator: {
                ...savedEvaluator,
                savedRevision: getEvaluatorTaskRevision(savedEvaluator),
              },
            },
            ...(saved.prompt ? { prompt: saved.prompt } : {}),
          },
          dirty: false,
        });
      }
      return {
        ok: true,
        output: {
          datasetEvaluatorId: saved.datasetEvaluatorId,
          action: saved.action,
          name,
        },
      };
    } catch (error) {
      const message = getSaveErrorMessage(error);
      setSaveError(message);
      return { ok: false, error: message };
    }
  }

  const button = (
    <Button
      size="S"
      leadingVisual={<Icon svg={<Icons.Save />} />}
      onPress={() => setIsDialogOpen(true)}
      isDisabled={!datasetId || !!validationError || isSaving}
      isPending={isSaving}
    >
      Save
    </Button>
  );

  return (
    <>
      {datasetId ? (
        button
      ) : (
        <DisabledButtonTooltip
          label="Save"
          reason="Select a dataset to save this evaluator"
        >
          {button}
        </DisabledButtonTooltip>
      )}
      <SaveEvaluatorTaskDialog
        target={saveTarget}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        isSaving={isSaving}
        error={saveError}
        onSave={async (options) => {
          const result = await save(options);
          if (result.ok) setIsDialogOpen(false);
          return result;
        }}
      />
    </>
  );
}

function getSaveErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return (
    getErrorMessagesFromRelayMutationError(error)?.join("\n") ?? error.message
  );
}
