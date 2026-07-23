import type { Ref } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { graphql, readInlineData, useLazyLoadQuery } from "react-relay";
import type { PanelImperativeHandle } from "react-resizable-panels";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import {
  createReadDatasetEvaluatorDefinitionClientAction,
  READ_DATASET_EVALUATOR_DEFINITION_TOOL_NAME,
} from "@phoenix/agent/tools/datasetEvaluatorDefinition";
import {
  createOpenDatasetEvaluatorForEditClientAction,
  OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME,
} from "@phoenix/agent/tools/datasetEvaluatorForEdit";
import {
  createSetDatasetEvaluatorSelectionClientAction,
  SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME,
} from "@phoenix/agent/tools/datasetEvaluatorSelection";
import { Flex } from "@phoenix/components";
import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { EvaluatorInputMappingInput } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import type {
  PlaygroundDatasetSection_evaluator$data,
  PlaygroundDatasetSection_evaluator$key,
} from "@phoenix/pages/playground/__generated__/PlaygroundDatasetSection_evaluator.graphql";
import type { PlaygroundDatasetSectionQuery } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetSectionQuery.graphql";
import type { EditingEvaluator } from "@phoenix/pages/playground/playgroundEvaluatorEditing";
import type { Mutable } from "@phoenix/typeUtils";
import { datasetEvaluatorsToAnnotationConfigs } from "@phoenix/utils/datasetEvaluatorUtils";

import { PlaygroundDatasetExamplesTable } from "./PlaygroundDatasetExamplesTable";
import { PlaygroundDatasetExamplesTableProvider } from "./PlaygroundDatasetExamplesTableContext";
import { PlaygroundExperimentToolbar } from "./PlaygroundExperimentToolbar";

/**
 * Panel config for the experiment (io) section. Shared with the Suspense
 * fallback in Playground.tsx so the two stay in sync.
 */
export const IO_PANEL_PROPS = { id: "io", minSize: "15%" } as const;

export function PlaygroundDatasetSection({
  datasetId,
  splitIds,
  isCodeEvaluatorFormOpen,
  onCodeEvaluatorFormOpenChange,
  isLlmEvaluatorFormOpen,
  onLlmEvaluatorFormOpenChange,
  panelRef,
  onPanelCollapseChange,
}: {
  datasetId: string;
  splitIds?: string[];
  isCodeEvaluatorFormOpen: boolean;
  onCodeEvaluatorFormOpenChange: (isOpen: boolean) => void;
  isLlmEvaluatorFormOpen: boolean;
  onLlmEvaluatorFormOpenChange: (isOpen: boolean) => void;
  panelRef?: Ref<PanelImperativeHandle | null>;
  onPanelCollapseChange?: (collapsed: boolean) => void;
}) {
  const data = useLazyLoadQuery<PlaygroundDatasetSectionQuery>(
    graphql`
      query PlaygroundDatasetSectionQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            datasetEvaluators(first: 100)
              @connection(key: "PlaygroundDatasetSection_datasetEvaluators") {
              __id
              edges {
                node {
                  ...PlaygroundDatasetSection_evaluator
                }
              }
            }
          }
        }
        ...PlaygroundEvaluatorSelect_query
      }
    `,
    {
      datasetId,
    },
    {
      fetchPolicy: "network-only",
    }
  );

  type DatasetEvaluatorNode = PlaygroundDatasetSection_evaluator$data;
  const datasetEvaluators: (DatasetEvaluatorNode & EvaluatorItem)[] = useMemo(
    () =>
      data.dataset.datasetEvaluators?.edges?.map((edge) => {
        const evaluator =
          readInlineData<PlaygroundDatasetSection_evaluator$key>(
            graphql`
              fragment PlaygroundDatasetSection_evaluator on DatasetEvaluator
              @inline {
                id
                name
                inputMapping {
                  literalMapping
                  pathMapping
                }
                evaluator {
                  id
                  kind
                  isBuiltin
                }
                outputConfigs {
                  __typename
                  ... on CategoricalAnnotationConfig {
                    name
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    optimizationDirection
                    lowerBound
                    upperBound
                  }
                  ... on FreeformAnnotationConfig {
                    name
                    optimizationDirection
                    threshold
                    lowerBound
                    upperBound
                  }
                }
              }
            `,
            edge.node
          );
        return {
          ...evaluator,
          kind: evaluator.evaluator.kind,
          isBuiltIn: evaluator.evaluator.isBuiltin,
          isAssignedToDataset: true,
          annotationName: evaluator.name,
        };
      }) ?? [],
    [data.dataset.datasetEvaluators]
  );
  const initialEvaluatorIds = usePlaygroundContext(
    (state) => state.initialSelectedDatasetEvaluatorIds
  );
  const [selectedDatasetEvaluatorIds, setSelectedDatasetEvaluatorIds] =
    useState<string[]>(() => {
      if (initialEvaluatorIds) {
        // When rehydrating from an experiment, only select the evaluators
        // that were attached to that experiment (not all dataset evaluators).
        return datasetEvaluators
          .filter((e) => initialEvaluatorIds.includes(e.id))
          .map((e) => e.id);
      }
      return datasetEvaluators.map((e) => e.id);
    });
  const onEvaluatorCreated = useCallback((datasetEvaluatorId: string) => {
    setSelectedDatasetEvaluatorIds((prev) => [...prev, datasetEvaluatorId]);
  }, []);

  const [editingEvaluator, setEditingEvaluator] =
    useState<EditingEvaluator | null>(null);

  // Held in refs, not deps, so re-registering the client actions on every roster or
  // edit change doesn't tear down in-flight agent calls.
  const agentStore = useAgentStore();
  const evaluatorsRef = useRef<EvaluatorItem[]>(datasetEvaluators);
  const editingEvaluatorRef = useRef<EditingEvaluator | null>(editingEvaluator);
  useEffect(() => {
    evaluatorsRef.current = datasetEvaluators;
    editingEvaluatorRef.current = editingEvaluator;
  }, [datasetEvaluators, editingEvaluator]);

  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(
      SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME,
      createSetDatasetEvaluatorSelectionClientAction({
        getEvaluators: () => evaluatorsRef.current,
        setSelectedDatasetEvaluatorIds,
      })
    );
    registerClientAction(
      OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME,
      createOpenDatasetEvaluatorForEditClientAction({
        agentStore,
        getEvaluators: () => evaluatorsRef.current,
        getEditingEvaluator: () => editingEvaluatorRef.current,
        openEvaluatorForEdit: setEditingEvaluator,
      })
    );
    registerClientAction(
      READ_DATASET_EVALUATOR_DEFINITION_TOOL_NAME,
      createReadDatasetEvaluatorDefinitionClientAction({
        datasetId,
        getEvaluators: () => evaluatorsRef.current,
      })
    );
    return () => {
      unregisterClientAction(SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME);
      unregisterClientAction(OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME);
      unregisterClientAction(READ_DATASET_EVALUATOR_DEFINITION_TOOL_NAME);
    };
  }, [agentStore, datasetId]);

  // Advertise the roster so the agent can resolve an evaluator name to its id; selectActiveContexts merges it with Playground.tsx's instances.
  const advertisedEvaluatorRoster = useMemo<AgentContext>(
    () => ({
      type: "playground" as const,
      evaluators: datasetEvaluators.map((evaluator) => ({
        datasetEvaluatorId: evaluator.id,
        name: evaluator.name,
        kind: evaluator.kind,
        isBuiltin: evaluator.isBuiltIn,
        isApplied: selectedDatasetEvaluatorIds.includes(evaluator.id),
      })),
    }),
    [datasetEvaluators, selectedDatasetEvaluatorIds]
  );
  useAdvertiseAgentContext(advertisedEvaluatorRoster);

  const selectedEvaluatorWithInputMapping = useMemo(() => {
    return datasetEvaluators
      .filter((datasetEvaluator) =>
        selectedDatasetEvaluatorIds.includes(datasetEvaluator.id)
      )
      .reduce< Record<
          string,
          { name: string; inputMapping: EvaluatorInputMappingInput }
        >>(
        (acc, datasetEvaluator) => {
          acc[datasetEvaluator.id] = {
            name: datasetEvaluator.name,
            inputMapping:
              datasetEvaluator.inputMapping as Mutable<EvaluatorInputMappingInput>,
          };
          return acc;
        },
        {}
      );
  }, [datasetEvaluators, selectedDatasetEvaluatorIds]);
  const evaluatorOutputConfigs = useMemo(() => {
    const selectedEvaluators = datasetEvaluators.filter((datasetEvaluator) =>
      selectedDatasetEvaluatorIds.includes(datasetEvaluator.id)
    );
    return datasetEvaluatorsToAnnotationConfigs(selectedEvaluators);
  }, [datasetEvaluators, selectedDatasetEvaluatorIds]);

  // We want to re-mount the context when the dataset or the splits change
  const key = `${datasetId}-${splitIds?.join("-")}`;
  return (
    <TitledPanel
      ref={panelRef}
      resizable
      headingLevel={2}
      title="Experiment"
      extra={
        <PlaygroundExperimentToolbar
          datasetId={datasetId}
          datasetEvaluators={datasetEvaluators}
          selectedDatasetEvaluatorIds={selectedDatasetEvaluatorIds}
          onSelectionChange={setSelectedDatasetEvaluatorIds}
          updateConnectionIds={
            data.dataset.datasetEvaluators?.__id != null
              ? [data.dataset.datasetEvaluators.__id]
              : []
          }
          onEvaluatorCreated={onEvaluatorCreated}
          query={data}
          isCodeEvaluatorFormOpen={isCodeEvaluatorFormOpen}
          onCodeEvaluatorFormOpenChange={onCodeEvaluatorFormOpenChange}
          isLlmEvaluatorFormOpen={isLlmEvaluatorFormOpen}
          onLlmEvaluatorFormOpenChange={onLlmEvaluatorFormOpenChange}
          editingEvaluator={editingEvaluator}
          onEditingEvaluatorChange={setEditingEvaluator}
        />
      }
      panelProps={IO_PANEL_PROPS}
      onCollapseChange={onPanelCollapseChange}
    >
      <Flex direction={"column"} height={"100%"}>
        <PlaygroundDatasetExamplesTableProvider key={key}>
          <PlaygroundDatasetExamplesTable
            datasetId={datasetId}
            splitIds={splitIds}
            evaluatorMappings={selectedEvaluatorWithInputMapping}
            evaluatorOutputConfigs={evaluatorOutputConfigs}
          />
        </PlaygroundDatasetExamplesTableProvider>
      </Flex>
    </TitledPanel>
  );
}
