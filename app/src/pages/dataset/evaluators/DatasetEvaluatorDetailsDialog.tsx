import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Icon,
  Icons,
} from "@phoenix/components";

import { DatasetEvaluatorDetailsDialogQuery } from "./__generated__/DatasetEvaluatorDetailsDialogQuery.graphql";
import { BuiltInDatasetEvaluatorDetails } from "./BuiltInDatasetEvaluatorDetails";
import { LLMDatasetEvaluatorDetails } from "./LLMDatasetEvaluatorDetails";

/**
 * Slideover content with the details of a dataset evaluator.
 */
export function DatasetEvaluatorDetailsDialog({
  evaluatorId,
  datasetId,
}: {
  evaluatorId: string;
  datasetId: string;
}) {
  const [isEditSlideoverOpen, setIsEditSlideoverOpen] = useState(false);

  const data = useLazyLoadQuery<DatasetEvaluatorDetailsDialogQuery>(
    graphql`
      query DatasetEvaluatorDetailsDialogQuery(
        $datasetId: ID!
        $datasetEvaluatorId: ID!
      ) {
        dataset: node(id: $datasetId) {
          id
          ... on Dataset {
            id
            datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {
              id
              displayName
              evaluator {
                __typename
                kind
                description
                isBuiltin
              }
              ...BuiltInDatasetEvaluatorDetails_datasetEvaluator
              ...LLMDatasetEvaluatorDetails_datasetEvaluator
            }
          }
        }
      }
    `,
    { datasetId, datasetEvaluatorId: evaluatorId },
    { fetchPolicy: "store-and-network" }
  );

  const datasetEvaluator = data.dataset?.datasetEvaluator;

  if (!datasetEvaluator) {
    return null;
  }

  const evaluator = datasetEvaluator.evaluator;
  const isLLMEvaluator = evaluator.__typename === "LLMEvaluator";
  const isBuiltInEvaluator = evaluator.__typename === "BuiltInEvaluator";

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Evaluator: {datasetEvaluator.displayName}</DialogTitle>
          <DialogTitleExtra>
            <Button
              size="S"
              variant="primary"
              onPress={() => setIsEditSlideoverOpen(true)}
              leadingVisual={<Icon svg={<Icons.EditOutline />} />}
            >
              Edit
            </Button>
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        {isLLMEvaluator && (
          <LLMDatasetEvaluatorDetails
            datasetEvaluatorRef={datasetEvaluator}
            datasetId={datasetId}
            isEditSlideoverOpen={isEditSlideoverOpen}
            onEditSlideoverOpenChange={setIsEditSlideoverOpen}
          />
        )}
        {isBuiltInEvaluator && (
          <BuiltInDatasetEvaluatorDetails
            datasetEvaluatorRef={datasetEvaluator}
            datasetId={datasetId}
            isEditSlideoverOpen={isEditSlideoverOpen}
            onEditSlideoverOpenChange={setIsEditSlideoverOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
