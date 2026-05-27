import { css } from "@emotion/react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFragment } from "react-relay";
import { useLoaderData, useParams, useSearchParams } from "react-router";
import { graphql } from "relay-runtime";
import invariant from "tiny-invariant";
import z from "zod";

import { Loading } from "@phoenix/components";
import { CreateBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateBuiltInDatasetEvaluatorSlideover";
import { CreateCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateCodeDatasetEvaluatorSlideover";
import {
  type CreateLLMDatasetEvaluatorInitialState,
  CreateLLMDatasetEvaluatorSlideover,
} from "@phoenix/components/dataset/CreateLLMDatasetEvaluatorSlideover";
import { AddEvaluatorMenu } from "@phoenix/components/evaluators/AddEvaluatorMenu";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useNotify } from "@phoenix/contexts/NotificationContext";
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

const FROM_AGENT_PROPOSAL_PARAM = "fromAgentProposal";

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

  const [searchParams, setSearchParams] = useSearchParams();
  const fromAgentProposal = searchParams.get(FROM_AGENT_PROPOSAL_PARAM);
  const agentStore = useAgentStore();
  const notify = useNotify();

  // Lock in the active handoff at first render only. The URL param is the
  // navigation primitive; the agent client action writes the snapshot to the
  // store before calling navigate(), so the store entry is guaranteed to be
  // present here when the param is. Once captured, we clear the param so
  // reloads don't replay the handoff. The store entry is the snapshot carrier.
  const claimedToolCallIdRef = useRef<string | null>(null);
  const missingSnapshotRef = useRef(false);
  const [agentHandoffToolCallId, setAgentHandoffToolCallId] = useState<
    string | null
  >(() => {
    if (typeof window === "undefined") return null;
    const initialParam = new URLSearchParams(window.location.search).get(
      FROM_AGENT_PROPOSAL_PARAM
    );
    if (!initialParam) return null;
    const entry =
      agentStore.getState().pendingCodeEvaluatorCreatesByToolCallId[
        initialParam
      ];
    if (!entry || entry.kind !== "handoff") {
      missingSnapshotRef.current = true;
      return null;
    }
    claimedToolCallIdRef.current = initialParam;
    return initialParam;
  });

  const clearFromAgentParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(FROM_AGENT_PROPOSAL_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (!fromAgentProposal) return;
    if (missingSnapshotRef.current) {
      missingSnapshotRef.current = false;
      notify({
        title: "Editor handoff unavailable",
        message:
          "The proposed code-evaluator snapshot is no longer available. Re-issue the create from PXI.",
      });
    }
    clearFromAgentParam();
  }, [fromAgentProposal, notify, clearFromAgentParam]);

  const agentHandoffEntry = useMemo(() => {
    if (!agentHandoffToolCallId) return null;
    const entry =
      agentStore.getState().pendingCodeEvaluatorCreatesByToolCallId[
        agentHandoffToolCallId
      ];
    if (!entry || entry.kind !== "handoff") return null;
    return entry;
  }, [agentHandoffToolCallId, agentStore]);

  useEffect(() => {
    return () => {
      const toolCallId = claimedToolCallIdRef.current;
      if (!toolCallId) return;
      const entry =
        agentStore.getState().pendingCodeEvaluatorCreatesByToolCallId[
          toolCallId
        ];
      if (entry && entry.kind === "handoff" && !entry.resolved) {
        void entry.cancel?.();
      }
    };
  }, [agentStore]);

  const handleAgentHandoffOpenChange = useCallback(
    (nextIsOpen: boolean) => {
      if (nextIsOpen) return;
      const toolCallId = claimedToolCallIdRef.current;
      if (!toolCallId) return;
      const entry =
        agentStore.getState().pendingCodeEvaluatorCreatesByToolCallId[
          toolCallId
        ];
      if (entry && entry.kind === "handoff") {
        void entry.resolveAsRejected?.();
      }
      setAgentHandoffToolCallId(null);
    },
    [agentStore]
  );

  const handleAgentHandoffSuccess = useCallback(
    (result: {
      createdEvaluator: { id: string; name: string };
      datasetEvaluatorId: string;
    }) => {
      const toolCallId = claimedToolCallIdRef.current;
      if (!toolCallId) return;
      const entry =
        agentStore.getState().pendingCodeEvaluatorCreatesByToolCallId[
          toolCallId
        ];
      if (entry && entry.kind === "handoff") {
        void entry.resolveAsAccepted?.(result);
      }
      setAgentHandoffToolCallId(null);
    },
    [agentStore]
  );

  const handleAgentHandoffError = useCallback(
    (errorMessage: string) => {
      const toolCallId = claimedToolCallIdRef.current;
      if (!toolCallId) return;
      const entry =
        agentStore.getState().pendingCodeEvaluatorCreatesByToolCallId[
          toolCallId
        ];
      if (entry && entry.kind === "handoff") {
        void entry.resolveAsFailed?.(errorMessage);
      }
      setAgentHandoffToolCallId(null);
    },
    [agentStore]
  );

  const agentHandoffSnapshot = agentHandoffEntry?.after ?? null;

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
        isOpen={agentHandoffToolCallId !== null && agentHandoffEntry !== null}
        onOpenChange={handleAgentHandoffOpenChange}
        datasetId={datasetId}
        updateConnectionIds={connectionsToUpdate}
        initialSnapshot={agentHandoffSnapshot}
        onSubmitSuccess={handleAgentHandoffSuccess}
        onSubmitError={handleAgentHandoffError}
      />
    </>
  );
}
