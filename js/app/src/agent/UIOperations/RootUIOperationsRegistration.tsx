import { useEffect } from "react";

import {
  createCreateAnnotationConfigClientAction,
  createUpdateAnnotationConfigClientAction,
} from "@phoenix/agent/tools/annotationConfig";
import { createBatchSpanAnnotateClientAction } from "@phoenix/agent/tools/batchSpanAnnotate";
import { createCreateDatasetClientAction } from "@phoenix/agent/tools/createDataset";
import {
  createDeleteDatasetClientAction,
  createPatchDatasetClientAction,
} from "@phoenix/agent/tools/datasetEdit";
import {
  createAddDatasetExamplesClientAction,
  createDeleteDatasetExamplesClientAction,
  createPatchDatasetExamplesClientAction,
} from "@phoenix/agent/tools/datasetExamples";
import {
  createCreateDatasetLabelClientAction,
  createDeleteDatasetLabelsClientAction,
  createSetDatasetLabelsClientAction,
} from "@phoenix/agent/tools/datasetLabels";
import {
  createCreateDatasetSplitClientAction,
  createDeleteDatasetSplitsClientAction,
  createPatchDatasetSplitClientAction,
  createSetDatasetExampleSplitsClientAction,
} from "@phoenix/agent/tools/datasetSplits";
import { createPatchExperimentClientAction } from "@phoenix/agent/tools/patchExperiment";
import { createAddSpansToDatasetClientAction } from "@phoenix/agent/tools/spansToDataset";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { registerUIOperation, unregisterUIOperation } from "./catalog";
import {
  annotationConfigOperations,
  createAnnotationConfigOperation,
  updateAnnotationConfigOperation,
} from "./operations/annotationConfig";
import {
  createDatasetLabelOperation,
  datasetLabelOperations,
  deleteDatasetLabelsOperation,
  setDatasetLabelsOperation,
} from "./operations/datasetLabels";
import {
  createDatasetSplitOperation,
  datasetSplitOperations,
  deleteDatasetSplitsOperation,
  patchDatasetSplitOperation,
  setDatasetExampleSplitsOperation,
} from "./operations/datasetSplits";
import {
  addDatasetExamplesOperation,
  addSpansToDatasetOperation,
  createDatasetOperation,
  datasetWriteOperations,
  deleteDatasetExamplesOperation,
  deleteDatasetOperation,
  patchDatasetExamplesOperation,
  patchDatasetOperation,
} from "./operations/datasetWrites";
import {
  experimentOperations,
  patchExperimentOperation,
} from "./operations/experiment";
import { batchSpanAnnotateOperation, spanOperations } from "./operations/spans";

/** Every operation family registered at the root, for unmount cleanup. */
const rootUIOperations = [
  ...datasetWriteOperations,
  ...datasetSplitOperations,
  ...datasetLabelOperations,
  ...annotationConfigOperations,
  ...experimentOperations,
  ...spanOperations,
];

/**
 * Registers the UI operations that are not tied to any page's UI surface —
 * dataset writes execute against the singleton Relay environment and resolve
 * their targets from the advertised agent context, so their handlers mount
 * once at the app root and stay available everywhere. Rendered (as nothing)
 * inside the `AgentProvider` at the authenticated root.
 */
export function RootUIOperationsRegistration() {
  const agentStore = useAgentStore();

  useEffect(() => {
    registerUIOperation({
      agentStore,
      descriptor: createDatasetOperation,
      handler: createCreateDatasetClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: patchDatasetOperation,
      handler: createPatchDatasetClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: deleteDatasetOperation,
      handler: createDeleteDatasetClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: addDatasetExamplesOperation,
      handler: createAddDatasetExamplesClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: patchDatasetExamplesOperation,
      handler: createPatchDatasetExamplesClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: deleteDatasetExamplesOperation,
      handler: createDeleteDatasetExamplesClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: addSpansToDatasetOperation,
      handler: createAddSpansToDatasetClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: createDatasetSplitOperation,
      handler: createCreateDatasetSplitClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: setDatasetExampleSplitsOperation,
      handler: createSetDatasetExampleSplitsClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: patchDatasetSplitOperation,
      handler: createPatchDatasetSplitClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: deleteDatasetSplitsOperation,
      handler: createDeleteDatasetSplitsClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: createDatasetLabelOperation,
      handler: createCreateDatasetLabelClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: setDatasetLabelsOperation,
      handler: createSetDatasetLabelsClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: deleteDatasetLabelsOperation,
      handler: createDeleteDatasetLabelsClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: createAnnotationConfigOperation,
      handler: createCreateAnnotationConfigClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: updateAnnotationConfigOperation,
      handler: createUpdateAnnotationConfigClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: patchExperimentOperation,
      handler: createPatchExperimentClientAction({ agentStore }),
    });
    registerUIOperation({
      agentStore,
      descriptor: batchSpanAnnotateOperation,
      handler: createBatchSpanAnnotateClientAction({ agentStore }),
    });
    return () => {
      for (const descriptor of rootUIOperations) {
        unregisterUIOperation({ agentStore, name: descriptor.name });
      }
    };
  }, [agentStore]);

  return null;
}
