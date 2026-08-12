import { useEffect } from "react";

import {
  createCreateAnnotationConfigClientAction,
  createUpdateAnnotationConfigClientAction,
} from "@phoenix/agent/tools/annotationConfig";
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

import { registerUiOperation, unregisterUiOperation } from "./catalog";
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

/** Every operation family registered at the root, for unmount cleanup. */
const rootUiOperations = [
  ...datasetWriteOperations,
  ...datasetSplitOperations,
  ...datasetLabelOperations,
  ...annotationConfigOperations,
  ...experimentOperations,
];

/**
 * Registers the UI operations that are not tied to any page's UI surface —
 * dataset writes execute against the singleton Relay environment and resolve
 * their targets from the advertised agent context, so their handlers mount
 * once at the app root and stay available everywhere. Rendered (as nothing)
 * inside the `AgentProvider` at the authenticated root.
 */
export function RootUiOperationsRegistration() {
  const agentStore = useAgentStore();

  useEffect(() => {
    registerUiOperation({
      agentStore,
      descriptor: createDatasetOperation,
      handler: createCreateDatasetClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: patchDatasetOperation,
      handler: createPatchDatasetClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: deleteDatasetOperation,
      handler: createDeleteDatasetClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: addDatasetExamplesOperation,
      handler: createAddDatasetExamplesClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: patchDatasetExamplesOperation,
      handler: createPatchDatasetExamplesClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: deleteDatasetExamplesOperation,
      handler: createDeleteDatasetExamplesClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: addSpansToDatasetOperation,
      handler: createAddSpansToDatasetClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: createDatasetSplitOperation,
      handler: createCreateDatasetSplitClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: setDatasetExampleSplitsOperation,
      handler: createSetDatasetExampleSplitsClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: patchDatasetSplitOperation,
      handler: createPatchDatasetSplitClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: deleteDatasetSplitsOperation,
      handler: createDeleteDatasetSplitsClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: createDatasetLabelOperation,
      handler: createCreateDatasetLabelClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: setDatasetLabelsOperation,
      handler: createSetDatasetLabelsClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: deleteDatasetLabelsOperation,
      handler: createDeleteDatasetLabelsClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: createAnnotationConfigOperation,
      handler: createCreateAnnotationConfigClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: updateAnnotationConfigOperation,
      handler: createUpdateAnnotationConfigClientAction({ agentStore }),
    });
    registerUiOperation({
      agentStore,
      descriptor: patchExperimentOperation,
      handler: createPatchExperimentClientAction({ agentStore }),
    });
    return () => {
      for (const descriptor of rootUiOperations) {
        unregisterUiOperation({ agentStore, name: descriptor.name });
      }
    };
  }, [agentStore]);

  return null;
}
