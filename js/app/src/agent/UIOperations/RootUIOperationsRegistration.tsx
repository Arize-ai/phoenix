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

import { registerUIOperation, unregisterUIOperation } from "./catalog";
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
    return () => {
      for (const descriptor of datasetWriteOperations) {
        unregisterUIOperation({ agentStore, name: descriptor.name });
      }
    };
  }, [agentStore]);

  return null;
}
