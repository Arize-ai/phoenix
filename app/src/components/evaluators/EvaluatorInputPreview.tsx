import { Suspense, useEffect, useEffectEvent, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import { Loading } from "@phoenix/components";
import { EvaluatorInputPreviewContentQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorInputPreviewContentQuery.graphql";
import { EvaluatorMappingSourceEditor } from "@phoenix/components/evaluators/EvaluatorMappingSourceEditor";
import { datasetExampleToEvaluatorInput } from "@phoenix/components/evaluators/utils";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";
import { EVALUATOR_MAPPING_SOURCE_DEFAULT } from "@phoenix/store/evaluatorStore";

/**
 * Given a datasetId, splitIds, and optional exampleId, this component will
 * fetch the dataset with splits, and then show the first example or the example chosen.
 *
 * It will display the hypothetical input for the evaluator, given the dataset example.
 */
export const EvaluatorInputPreview = () => {
  return (
    <>
      <div
        css={css`
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          border-top: 1px solid var(--ac-global-border-color-default);
        `}
      >
        <Suspense fallback={<Loading />}>
          <EvaluatorInputPreviewContent />
        </Suspense>
      </div>
    </>
  );
};

const EvaluatorInputPreviewContent = () => {
  const {
    datasetId,
    splitIds,
    exampleId,
    evaluatorMappingSource,
    setSelectedExampleId,
    setEvaluatorMappingSource,
    setEvaluatorMappingSourceField,
  } = useEvaluatorStore(
    useShallow((state) => {
      if (!state.dataset) {
        throw new Error("Dataset is required to preview the evaluator input");
      }
      return {
        datasetId: state.dataset.id,
        splitIds: state.dataset.selectedSplitIds,
        exampleId: state.dataset.selectedExampleId,
        evaluatorMappingSource: state.evaluatorMappingSource,
        setSelectedExampleId: state.setSelectedExampleId,
        setEvaluatorMappingSource: state.setEvaluatorMappingSource,
        setEvaluatorMappingSourceField: state.setEvaluatorMappingSourceField,
      };
    })
  );
  const data = useLazyLoadQuery<EvaluatorInputPreviewContentQuery>(
    graphql`
      query EvaluatorInputPreviewContentQuery(
        $datasetId: ID!
        $splitIds: [ID!]
        $hasDataset: Boolean!
      ) {
        dataset: node(id: $datasetId) @include(if: $hasDataset) {
          ... on Dataset {
            examples(splitIds: $splitIds) {
              edges {
                example: node {
                  id
                  revision {
                    ...utils_datasetExampleToEvaluatorInput_example
                  }
                }
              }
            }
          }
        }
      }
    `,
    { datasetId: datasetId ?? "", splitIds, hasDataset: datasetId != null }
  );
  const example = useMemo(() => {
    if (!data.dataset) {
      return null;
    }
    if (!exampleId) {
      return data.dataset.examples?.edges[0]?.example;
    }
    return data.dataset.examples?.edges.find(
      (edge) => edge.example.id === exampleId
    )?.example;
  }, [data, exampleId]);
  const onSelectExampleId = useEffectEvent(setSelectedExampleId);
  useEffect(() => {
    onSelectExampleId(example?.id ?? null);
  }, [example]);
  // generate a default value for the editor
  // this is derived from the example in the dataset
  const defaultValue = useMemo(() => {
    if (!example) {
      return EVALUATOR_MAPPING_SOURCE_DEFAULT;
    }
    try {
      const evaluatorInput = datasetExampleToEvaluatorInput({
        exampleRef: example.revision,
        taskOutput: EVALUATOR_MAPPING_SOURCE_DEFAULT.output,
      });
      return evaluatorInput;
    } catch {
      return EVALUATOR_MAPPING_SOURCE_DEFAULT;
    }
  }, [example]);
  // if the default value changes, propagate the change upwards to parent
  // this value is the one that will actually be used when testing an evaluator
  const setEvaluatorInputObject = useEffectEvent(setEvaluatorMappingSource);
  useEffect(() => {
    setEvaluatorInputObject(defaultValue);
  }, [defaultValue]);

  return (
    <EvaluatorMappingSourceEditor
      value={evaluatorMappingSource}
      onFieldChange={setEvaluatorMappingSourceField}
      editorKeyPrefix={`${datasetId}-${exampleId}`}
    />
  );
};
