import { useEffect } from "react";

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
import { createAddSpansToDatasetClientAction } from "@phoenix/agent/tools/spansToDataset";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { registerUiOperation, unregisterUiOperation } from "./catalog";
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
    return () => {
      for (const descriptor of datasetWriteOperations) {
        unregisterUiOperation({ agentStore, name: descriptor.name });
      }
    };
  }, [agentStore]);

  return null;
}
