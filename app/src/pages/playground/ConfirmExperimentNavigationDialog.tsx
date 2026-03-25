import { graphql, useMutation } from "react-relay";
import type { Blocker } from "react-router";

import {
  Button,
  Dialog,
  Flex,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";

/**
 * Navigation dialog shown when leaving the playground while an experiment is running.
 *
 * - Ephemeral experiment: "Your experiment will stop if you leave." → Stay / Leave
 * - Non-ephemeral experiment: "Experiment will keep running." → Stay / Keep running / Stop and leave
 */
export function ConfirmExperimentNavigationDialog({
  blocker,
  experimentId,
  isEphemeral,
}: {
  blocker: Blocker;
  experimentId: string;
  isEphemeral: boolean;
}) {
  const [commitDelete] = useMutation(graphql`
    mutation ConfirmExperimentNavigationDialogDeleteMutation(
      $input: DeleteExperimentsInput!
    ) {
      deleteExperiments(input: $input) {
        __typename
      }
    }
  `);

  if (isEphemeral) {
    return (
      <ModalOverlay isDismissable={false} isOpen={blocker.state === "blocked"}>
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Experiment In Progress</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton close={() => blocker.reset?.()} />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  Your experiment will stop if you leave this page. Stay to let
                  it finish.
                </Text>
              </View>
              <View
                padding="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex justifyContent="end" gap="size-100">
                  <Button size="S" onPress={() => blocker.proceed?.()}>
                    Leave
                  </Button>
                  <Button
                    variant="primary"
                    size="S"
                    onPress={() => blocker.reset?.()}
                  >
                    Stay
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay isDismissable={false} isOpen={blocker.state === "blocked"}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Experiment In Progress</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton close={() => blocker.reset?.()} />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Text>
                Your experiment will keep running in the background. You can
                check its progress from the experiments table.
              </Text>
            </View>
            <View
              padding="size-100"
              borderTopColor="default"
              borderTopWidth="thin"
            >
              <Flex justifyContent="end" gap="size-100">
                <Button size="S" onPress={() => blocker.reset?.()}>
                  Stay
                </Button>
                <Button
                  size="S"
                  variant="danger"
                  onPress={() => {
                    commitDelete({
                      variables: {
                        input: { experimentIds: [experimentId] },
                      },
                      onCompleted: () => blocker.proceed?.(),
                      onError: () => blocker.proceed?.(),
                    });
                  }}
                >
                  Stop and delete
                </Button>
                <Button
                  variant="primary"
                  size="S"
                  onPress={() => blocker.proceed?.()}
                >
                  Keep running
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
