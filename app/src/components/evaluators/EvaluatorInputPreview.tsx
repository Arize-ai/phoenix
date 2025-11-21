import { Suspense, useEffect, useEffectEvent, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { debounce } from "lodash";
import { css } from "@emotion/react";

import { Loading } from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { EvaluatorInputPreviewContentQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorInputPreviewContentQuery.graphql";
import {
  datasetExampleToEvaluatorInput,
  EMPTY_EVALUATOR_INPUT,
  EvaluatorInput,
} from "@phoenix/components/evaluators/utils";

type EvaluatorInputPreviewProps = {
  datasetId?: string | null;
  splitIds?: string[];
  exampleId?: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
  setEvaluatorInputObject: (evaluatorInput: EvaluatorInput | null) => void;
};

/**
 * Given a datasetId, splitIds, and optional exampleId, this component will
 * fetch the dataset with splits, and then show the first example or the example chosen.
 *
 * It will display the hypothetical input for the evaluator, given the dataset example.
 */
export const EvaluatorInputPreview = (props: EvaluatorInputPreviewProps) => {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        max-height: 400px;
        min-height: 100px;
        overflow-y: auto;
        border-radius: var(--ac-global-rounding-medium);
        background-color: var(--ac-global-input-field-background-color);
      `}
    >
      <Suspense fallback={<Loading />}>
        <EvaluatorInputPreviewContent {...props} />
      </Suspense>
    </div>
  );
};

const EvaluatorInputPreviewContent = ({
  datasetId,
  splitIds,
  exampleId,
  onSelectExampleId: _onSelectExampleId,
  setEvaluatorInputObject: _setEvaluatorInputObject,
}: EvaluatorInputPreviewProps) => {
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
  const onSelectExampleId = useEffectEvent(_onSelectExampleId);
  useEffect(() => {
    onSelectExampleId(example?.id ?? null);
  }, [example]);
  // generate a default value for the json editor
  // this is derived from the example in the dataset
  const defaultValue = useMemo(() => {
    if (!example) {
      return EMPTY_EVALUATOR_INPUT;
    }
    try {
      const evaluatorInput = datasetExampleToEvaluatorInput({
        exampleRef: example.revision,
      });
      return evaluatorInput;
    } catch {
      return EMPTY_EVALUATOR_INPUT;
    }
  }, [example]);
  // convert the default value to a string for usage in the json editor
  const stringValue = useMemo(() => {
    return JSON.stringify(defaultValue, null, 2);
  }, [defaultValue]);
  // if the default value changes, propagate the change upwards to parent
  // this value is the one that will actually be used when testing an evaluator
  const setEvaluatorInputObject = useEffectEvent(_setEvaluatorInputObject);
  useEffect(() => {
    setEvaluatorInputObject(defaultValue);
  }, [defaultValue]);
  // sync the string value within the json editor to the parent, every 500ms maximum
  const debouncedSetEvaluatorInputObject = useMemo(() => {
    return debounce((evaluatorInput: string) => {
      try {
        const evaluatorInputObject = JSON.parse(evaluatorInput);
        _setEvaluatorInputObject(evaluatorInputObject);
      } catch {
        // invalid json will be ignored, previous value will be maintained
        // noop
      }
    }, 500);
  }, [_setEvaluatorInputObject]);
  return (
    <JSONEditor
      key={`${datasetId}-${exampleId}`}
      value={stringValue}
      onChange={(value) => {
        debouncedSetEvaluatorInputObject(value);
      }}
    />
  );
};
