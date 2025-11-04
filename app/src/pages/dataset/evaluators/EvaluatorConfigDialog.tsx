import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
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
  Link,
  Text,
  View,
} from "@phoenix/components";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { EvaluatorConfigDialog_dataset$key } from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialog_dataset.graphql";
import { EvaluatorConfigDialog_evaluatorQuery } from "@phoenix/pages/dataset/evaluators/__generated__/EvaluatorConfigDialog_evaluatorQuery.graphql";
import { datasetEvaluatorsLoader } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";

export function EvaluatorConfigDialog({
  evaluatorId,
  onClose,
  datasetRef,
}: {
  evaluatorId: string;
  onClose: () => void;
  datasetRef: EvaluatorConfigDialog_dataset$key;
}) {
  const loaderData = useLoaderData<typeof datasetEvaluatorsLoader>();
  invariant(loaderData, "loaderData is required");
  const dataset = useFragment<EvaluatorConfigDialog_dataset$key>(
    graphql`
      fragment EvaluatorConfigDialog_dataset on Dataset {
        id
        name
      }
    `,
    datasetRef
  );

  const { evaluator } = useLazyLoadQuery<EvaluatorConfigDialog_evaluatorQuery>(
    graphql`
      query EvaluatorConfigDialog_evaluatorQuery($evaluatorId: ID!) {
        evaluator: node(id: $evaluatorId) {
          id
          ... on Evaluator {
            name
          }
          ... on LLMEvaluator {
            prompt {
              id
              name
            }
            promptVersion {
              ...PromptChatMessagesCard__main
            }
          }
        }
      }
    `,
    { evaluatorId }
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
              Add
              <Flex direction="row" alignItems="center" gap="size-25">
                <Icon svg={<Icons.Scale />} />
                {evaluator.name}
              </Flex>
              to
              <Flex direction="row" alignItems="center" gap="size-25">
                <Icon svg={<Icons.DatabaseOutline />} />
                {dataset.name}
              </Flex>
            </Flex>
          </DialogTitle>
          <DialogTitleExtra>
            <Button onPress={onClose}>Cancel</Button>
            <Button variant="primary" onPress={onAddEvaluator}>
              Done
            </Button>
          </DialogTitleExtra>
        </DialogHeader>
        <View
          paddingX="size-300"
          paddingBottom="size-300"
          paddingTop="size-200"
        >
          <Flex direction="row" alignItems="center" gap="size-200">
            <div>
              {evaluator.promptVersion && (
                <Flex direction="column" gap="size-100" marginBottom="size-300">
                  <Text>
                    This is in read only mode, you can{" "}
                    <Link to="TODO: link to evaluator edit page when it exists">
                      edit the global evaluator
                    </Link>
                  </Text>
                  <Text size="L">Prompt</Text>
                  <PromptChatMessages promptVersion={evaluator.promptVersion} />
                </Flex>
              )}
              <Flex direction="column" gap="size-100">
                <Text size="L">Eval</Text>
              </Flex>
            </div>
            <div></div>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
