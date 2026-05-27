import { css } from "@emotion/react";
import { Suspense, useMemo, useState } from "react";
import { useFragment } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import { graphql } from "relay-runtime";
import invariant from "tiny-invariant";
import z from "zod";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import { Loading } from "@phoenix/components";
import { CreateBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateBuiltInDatasetEvaluatorSlideover";
import { CreateCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateCodeDatasetEvaluatorSlideover";
import {
  type CreateLLMDatasetEvaluatorInitialState,
  CreateLLMDatasetEvaluatorSlideover,
} from "@phoenix/components/dataset/CreateLLMDatasetEvaluatorSlideover";
import { AddEvaluatorMenu } from "@phoenix/components/evaluators/AddEvaluatorMenu";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { DatasetEvaluatorsPage_builtInEvaluators$key } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorsPage_builtInEvaluators.graphql";
import type { datasetEvaluatorsLoader } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import { datasetEvaluatorsLoaderGQL } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import {
  DatasetEvaluatorsTable,
  useDatasetEvaluatorsTable,
} from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorsTable";
import { DatasetEvaluatorsFilterBar } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterBar";
import { DatasetEvaluatorsFilterProvider } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterProvider";

export function DatasetEvaluatorsPage() {
  return (
    <DatasetEvaluatorsFilterProvider>
      <Suspense fallback={<Loading />}>
        <DatasetEvaluatorsPageContent />
      </Suspense>
    </DatasetEvaluatorsFilterProvider>
  );
}

export function DatasetEvaluatorsPageContent() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");

  const advertisedDatasetEvaluatorsContext = useMemo(
    () => ({
      type: "dataset_evaluators" as const,
      datasetNodeId: datasetId,
      datasetVersionNodeId: null,
    }),
    [datasetId]
  );
  useAdvertiseAgentContext(advertisedDatasetEvaluatorsContext);

  const loaderData = useLoaderData<typeof datasetEvaluatorsLoader>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery({
    query: datasetEvaluatorsLoaderGQL,
    queryRef: loaderData,
  });
  const evaluatorsTableProps = useDatasetEvaluatorsTable(data.dataset);
  const evaluatorsTableData = evaluatorsTableProps.data;

  const builtInEvaluators =
    useFragment<DatasetEvaluatorsPage_builtInEvaluators$key>(
      graphql`
        fragment DatasetEvaluatorsPage_builtInEvaluators on Query {
          builtInEvaluators {
            id
            name
            description
          }
          classificationEvaluatorConfigs(
            labels: ["promoted_dataset_evaluator"]
          ) {
            name
            description
            choices
            optimizationDirection
            messages {
              ...promptUtils_promptMessages
            }
          }
        }
      `,
      data
    );

  // Dialog state for empty state template selection
  const [
    createLLMEvaluatorDialogInitialState,
    setCreateLLMEvaluatorDialogInitialState,
  ] = useState<CreateLLMDatasetEvaluatorInitialState | null>(null);
  const [builtinEvaluatorIdToAssociate, setBuiltinEvaluatorIdToAssociate] =
    useState<string | null>(null);

  const handleSelectLLMEvaluatorTemplate = (templateName: string) => {
    const template = builtInEvaluators.classificationEvaluatorConfigs.find(
      (t) => t.name === templateName
    );
    if (template) {
      const maybeValidatedChoices = z
        .record(z.string(), z.number())
        .safeParse(template.choices);
      const validatedChoices = maybeValidatedChoices.success
        ? maybeValidatedChoices.data
        : {};
      setCreateLLMEvaluatorDialogInitialState({
        name: template.name,
        description: template.description ?? "",
        outputConfigs: [
          {
            name: template.name,
            optimizationDirection: template.optimizationDirection,
            values: Object.entries(validatedChoices).map(([label, score]) => ({
              label,
              score,
            })),
          },
        ],
        promptMessages: template.messages,
      });
    }
  };

  const handleSelectCodeEvaluator = (evaluatorId: string) => {
    setBuiltinEvaluatorIdToAssociate(evaluatorId);
  };

  const connectionsToUpdate = useMemo(() => {
    if (evaluatorsTableData.datasetEvaluators.__id) {
      return [evaluatorsTableData.datasetEvaluators.__id];
    }
    return [];
  }, [evaluatorsTableData]);

  // The page selects only the pending create whose chat-side Confirm has
  // already flipped phase to "awaiting-slideover" AND whose snapshotted
  // dataset matches the dataset currently in view; this drives the second
  // (agent-handoff) slideover instance.
  const pendingAgentCreate = useAgentContext((state) => {
    const entries = Object.values(
      state.pendingCodeEvaluatorCreatesByToolCallId
    );
    for (const entry of entries) {
      if (
        entry &&
        entry.phase === "awaiting-slideover" &&
        entry.datasetContext.datasetNodeId === datasetId
      ) {
        return entry;
      }
    }
    return null;
  });

  return (
    <>
      <main
        css={css`
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
        `}
      >
        <DatasetEvaluatorsFilterBar
          padding="size-100"
          extraActions={
            <AddEvaluatorMenu
              size="M"
              datasetId={datasetId}
              updateConnectionIds={connectionsToUpdate}
              query={data}
            />
          }
        />
        <div
          css={css`
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            min-height: 0;
          `}
        >
          <Suspense fallback={<Loading />}>
            <DatasetEvaluatorsTable
              {...evaluatorsTableProps}
              builtInEvaluators={builtInEvaluators}
              onSelectLLMEvaluatorTemplate={handleSelectLLMEvaluatorTemplate}
              onSelectCodeEvaluator={handleSelectCodeEvaluator}
            />
          </Suspense>
        </div>
      </main>

      <CreateLLMDatasetEvaluatorSlideover
        isOpen={!!createLLMEvaluatorDialogInitialState}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setCreateLLMEvaluatorDialogInitialState(null);
          }
        }}
        datasetId={datasetId}
        updateConnectionIds={connectionsToUpdate}
        initialState={createLLMEvaluatorDialogInitialState ?? undefined}
      />

      <CreateBuiltInDatasetEvaluatorSlideover
        isOpen={builtinEvaluatorIdToAssociate != null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setBuiltinEvaluatorIdToAssociate(null);
          }
        }}
        evaluatorId={builtinEvaluatorIdToAssociate}
        datasetId={datasetId}
        updateConnectionIds={connectionsToUpdate}
      />

      <CreateCodeDatasetEvaluatorSlideover
        isOpen={pendingAgentCreate != null}
        // The slideover's open state is read from the agent store; closing
        // it just drives the chassis resolver. The component invokes
        // onCancel for user-driven close paths only.
        onOpenChange={() => undefined}
        datasetId={datasetId}
        updateConnectionIds={connectionsToUpdate}
        initialSnapshot={pendingAgentCreate?.after ?? null}
        onSubmitSuccess={(datasetEvaluatorId, createdEvaluator) =>
          void pendingAgentCreate?.resolveAsAccepted?.({
            datasetEvaluatorId,
            createdEvaluator,
          })
        }
        onSubmitError={(message) =>
          void pendingAgentCreate?.resolveAsFailed?.(message)
        }
        onCancel={() => void pendingAgentCreate?.resolveAsRejected?.()}
      />
    </>
  );
}
