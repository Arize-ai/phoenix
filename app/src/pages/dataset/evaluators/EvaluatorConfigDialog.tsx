import { graphql, useFragment } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { EvaluatorConfigDialog_dataset$key } from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialog_dataset.graphql";
import { datasetEvaluatorsLoader } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";

export function EvaluatorConfigDialog({
  onClose,
  datasetRef,
}: {
  onClose: () => void;
  datasetRef: EvaluatorConfigDialog_dataset$key;
}) {
  const loaderData = useLoaderData<typeof datasetEvaluatorsLoader>();
  invariant(loaderData, "loaderData is required");
  const dataset = useFragment(
    graphql`
      fragment EvaluatorConfigDialog_dataset on Dataset {
        id
        name
      }
    `,
    datasetRef
  );

  const onAddEvaluator = () => {
    // TODO: add evaluator to dataset
    onClose();
  };

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Flex direction="row" alignItems="center" gap="size-50">
              Add <Icon svg={<Icons.Scale />} />
              Evaluator to <Icon svg={<Icons.DatabaseOutline />} />
              {dataset.name}
            </Flex>
          </DialogTitle>
          <DialogTitleExtra>
            <Button onPress={onClose}>Cancel</Button>
            <Button variant="primary" onPress={onAddEvaluator}>
              Done
            </Button>
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Text>eval config stuff here</Text>
        </View>
      </DialogContent>
    </Dialog>
  );
}
