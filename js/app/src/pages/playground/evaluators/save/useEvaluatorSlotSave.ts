import { useState } from "react";
import { useRelayEnvironment } from "react-relay";

import type { EvaluatorSlotSource } from "../evaluatorPlaygroundSource";
import { fetchEvaluatorCopyName } from "./evaluatorCopyNameLookup";
import { saveDatasetEvaluator } from "./saveDatasetEvaluator";
import { saveProjectEvaluator } from "./saveProjectEvaluator";
import type { SaveEvaluatorSlotRequest, SavedEvaluatorSlot } from "./types";

/**
 * Saves a slot's draft the way the prompt playground saves a prompt: an
 * evaluator already on the dataset or project is updated in place, anything
 * else becomes a new dataset or project evaluator. Rejects with an Error
 * carrying the server message.
 */
export function useEvaluatorSlotSave() {
  const environment = useRelayEnvironment();
  const [isSaving, setIsSaving] = useState(false);

  async function save(
    request: SaveEvaluatorSlotRequest
  ): Promise<SavedEvaluatorSlot> {
    setIsSaving(true);

    try {
      return request.source.kind === "project"
        ? await saveProjectEvaluator(environment, request)
        : await saveDatasetEvaluator(environment, request);
    } finally {
      setIsSaving(false);
    }
  }

  function copyName(base: string, source: EvaluatorSlotSource) {
    return fetchEvaluatorCopyName(environment, base, source);
  }

  return { save, copyName, isSaving };
}
