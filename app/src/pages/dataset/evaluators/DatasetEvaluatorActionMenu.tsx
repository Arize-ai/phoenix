import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

enum DatasetEvaluatorAction {
  UNASSIGN = "unassign",
}

export function DatasetEvaluatorActionMenu({
  evaluatorId,
  datasetId,
}: {
  evaluatorId: string;
  datasetId: string;
}) {
  const datasetEvaluatorsTableConnection = ConnectionHandler.getConnectionID(
    datasetId,
    "DatasetEvaluatorsTable_evaluators"
  );
  const [unassignEvaluatorFromDataset, isUnassigningEvaluatorFromDataset] =
    useMutation(graphql`
      mutation DatasetEvaluatorActionMenu_UnassignEvaluatorFromDatasetMutation(
        $input: UnassignEvaluatorFromDatasetInput!
        $datasetId: ID!
        $connectionIds: [ID!]!
      ) {
        unassignEvaluatorFromDataset(input: $input) {
          # TODO: figure out how to make table update upon unassignment
          query {
            ...DatasetEvaluatorsPage_evaluators
              @arguments(datasetId: $datasetId)
          }
          evaluator @deleteEdge(connections: $connectionIds) {
            ...EvaluatorsTable_row @arguments(datasetId: $datasetId)
          }
        }
      }
    `);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          variant="quiet"
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
        />
        <Popover placement="bottom right">
          <Menu
            onAction={(action) => {
              switch (action) {
                case DatasetEvaluatorAction.UNASSIGN:
                  if (isUnassigningEvaluatorFromDataset) {
                    return;
                  }
                  unassignEvaluatorFromDataset({
                    variables: {
                      input: {
                        datasetId,
                        evaluatorId,
                      },
                      connectionIds: [datasetEvaluatorsTableConnection],
                      datasetId,
                    },
                    onCompleted: () => {
                      notifySuccess({
                        title: "Evaluator unassigned",
                        message:
                          "The evaluator has been unassigned from the dataset.",
                      });
                    },
                    onError: (error) => {
                      notifyError({
                        title: "Failed to unassign evaluator",
                        message:
                          getErrorMessagesFromRelayMutationError(error)?.join(
                            "\n"
                          ) ?? error.message,
                      });
                    },
                  });
                  break;
              }
            }}
          >
            <MenuItem
              id={DatasetEvaluatorAction.UNASSIGN}
              isDisabled={isUnassigningEvaluatorFromDataset}
            >
              Remove
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </StopPropagation>
  );
}
