import { Suspense, useMemo, useState } from "react";
import { useFragment, usePreloadedQuery } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import { graphql } from "relay-runtime";
import invariant from "tiny-invariant";
import z from "zod";
import { css } from "@emotion/react";

import { Loading } from "@phoenix/components";
import { CreateBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateBuiltInDatasetEvaluatorSlideover";
import {
  type CreateLLMDatasetEvaluatorInitialState,
  CreateLLMDatasetEvaluatorSlideover,
} from "@phoenix/components/dataset/CreateLLMDatasetEvaluatorSlideover";
import { AddEvaluatorMenu } from "@phoenix/components/evaluators/AddEvaluatorMenu";
import { DatasetEvaluatorsPage_builtInEvaluators$key } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorsPage_builtInEvaluators.graphql";
import {
  datasetEvaluatorsLoader,
  datasetEvaluatorsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
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

  const loaderData = useLoaderData<typeof datasetEvaluatorsLoader>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(datasetEvaluatorsLoaderGQL, loaderData);
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
          classificationEvaluatorConfigs {
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
        .record(z.number())
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
    </>
  );
}
