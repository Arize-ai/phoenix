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
 * - Non-ephemeral experiment: "Leave this page?" → Stay on page / Delete experiment / Leave page
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
              <DialogTitle>Leave this page?</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton close={() => blocker.reset?.()} />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Text>
                This experiment will continue running in the background. You can
                track its progress in the experiments table.
              </Text>
            </View>
            <View
              padding="size-100"
              borderTopColor="default"
              borderTopWidth="thin"
            >
              <Flex justifyContent="end" gap="size-100">
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
                  Delete experiment
                </Button>
                <Button size="S" onPress={() => blocker.reset?.()}>
                  Stay on page
                </Button>
                <Button
                  variant="primary"
                  size="S"
                  onPress={() => blocker.proceed?.()}
                >
                  Leave page
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
