import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

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
import { createNavigationGoToClientAction } from "@phoenix/agent/tools/navigation";
import { createPatchExperimentClientAction } from "@phoenix/agent/tools/patchExperiment";
import { createAddSpansToDatasetClientAction } from "@phoenix/agent/tools/spansToDataset";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { registerUIOperations } from "./catalog";
import {
  createAnnotationConfigOperation,
  updateAnnotationConfigOperation,
} from "./operations/annotationConfig";
import {
  createDatasetLabelOperation,
  deleteDatasetLabelsOperation,
  setDatasetLabelsOperation,
} from "./operations/datasetLabels";
import {
  createDatasetSplitOperation,
  deleteDatasetSplitsOperation,
  patchDatasetSplitOperation,
  setDatasetExampleSplitsOperation,
} from "./operations/datasetSplits";
import {
  addDatasetExamplesOperation,
  addSpansToDatasetOperation,
  createDatasetOperation,
  deleteDatasetExamplesOperation,
  deleteDatasetOperation,
  patchDatasetExamplesOperation,
  patchDatasetOperation,
} from "./operations/datasetWrites";
import { patchExperimentOperation } from "./operations/experiment";
import { navigationGoToOperation } from "./operations/navigation";
import { batchSpanAnnotateOperation } from "./operations/spans";

/**
 * Registers the UI operations that are not tied to any page's UI surface —
 * dataset writes execute against the singleton Relay environment and resolve
 * their targets from the advertised agent context, so their handlers mount
 * once at the app root and stay available everywhere. Rendered (as nothing)
 * inside the `AgentProvider` at the authenticated root.
 */
export function RootUIOperationsRegistration() {
  const agentStore = useAgentStore();
  const navigate = useNavigate();
  const location = useLocation();

  // The navigation handler outlives any one render: refs keep the registered
  // closure stable while always reading the current router state. The refs
  // are written in an effect (never during render, per the react refs rule);
  // the handler only runs from async operation dispatch, well after commit,
  // so it never observes the pre-effect value.
  const navigateRef = useRef(navigate);
  const pathRef = useRef(location.pathname);
  useEffect(() => {
    navigateRef.current = navigate;
    pathRef.current = location.pathname;
  }, [navigate, location.pathname]);

  useEffect(
    () =>
      registerUIOperations({
        agentStore,
        operations: [
          {
            descriptor: createDatasetOperation,
            handler: createCreateDatasetClientAction({ agentStore }),
          },
          {
            descriptor: patchDatasetOperation,
            handler: createPatchDatasetClientAction({ agentStore }),
          },
          {
            descriptor: deleteDatasetOperation,
            handler: createDeleteDatasetClientAction({ agentStore }),
          },
          {
            descriptor: addDatasetExamplesOperation,
            handler: createAddDatasetExamplesClientAction({ agentStore }),
          },
          {
            descriptor: patchDatasetExamplesOperation,
            handler: createPatchDatasetExamplesClientAction({ agentStore }),
          },
          {
            descriptor: deleteDatasetExamplesOperation,
            handler: createDeleteDatasetExamplesClientAction({ agentStore }),
          },
          {
            descriptor: addSpansToDatasetOperation,
            handler: createAddSpansToDatasetClientAction({ agentStore }),
          },
          {
            descriptor: createDatasetSplitOperation,
            handler: createCreateDatasetSplitClientAction({ agentStore }),
          },
          {
            descriptor: setDatasetExampleSplitsOperation,
            handler: createSetDatasetExampleSplitsClientAction({ agentStore }),
          },
          {
            descriptor: patchDatasetSplitOperation,
            handler: createPatchDatasetSplitClientAction({ agentStore }),
          },
          {
            descriptor: deleteDatasetSplitsOperation,
            handler: createDeleteDatasetSplitsClientAction({ agentStore }),
          },
          {
            descriptor: createDatasetLabelOperation,
            handler: createCreateDatasetLabelClientAction({ agentStore }),
          },
          {
            descriptor: setDatasetLabelsOperation,
            handler: createSetDatasetLabelsClientAction({ agentStore }),
          },
          {
            descriptor: deleteDatasetLabelsOperation,
            handler: createDeleteDatasetLabelsClientAction({ agentStore }),
          },
          {
            descriptor: createAnnotationConfigOperation,
            handler: createCreateAnnotationConfigClientAction({ agentStore }),
          },
          {
            descriptor: updateAnnotationConfigOperation,
            handler: createUpdateAnnotationConfigClientAction({ agentStore }),
          },
          {
            descriptor: patchExperimentOperation,
            handler: createPatchExperimentClientAction({ agentStore }),
          },
          {
            descriptor: batchSpanAnnotateOperation,
            handler: createBatchSpanAnnotateClientAction({ agentStore }),
          },
          {
            descriptor: navigationGoToOperation,
            handler: createNavigationGoToClientAction({
              agentStore,
              navigate: (path) => navigateRef.current(path),
              getCurrentPath: () => pathRef.current,
            }),
          },
        ],
      }),
    [agentStore]
  );

  return null;
}
