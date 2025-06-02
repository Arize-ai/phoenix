import { useState } from "react";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationConfigDialog } from "@phoenix/pages/settings/AnnotationConfigDialog";
import { AnnotationConfig } from "@phoenix/pages/settings/types";

interface AnnotationConfigSelectionToolbarProps {
  selectedConfig: AnnotationConfig;
  onClearSelection: () => void;
  onEditAnnotationConfig: (config: AnnotationConfig) => void;
  onDeleteAnnotationConfig: (
    configId: string,
    args?: { onCompleted?: () => void; onError?: () => void }
  ) => void;
}

export const AnnotationConfigSelectionToolbar = ({
  selectedConfig,
  onClearSelection,
  onEditAnnotationConfig,
  onDeleteAnnotationConfig,
}: AnnotationConfigSelectionToolbarProps) => {
  const [isEditing, setIsEditing] = useState(false);
  if (!selectedConfig) {
    return null;
  }
  const id = selectedConfig?.id;
  return (
    <div
      data-editing={isEditing}
      css={css`
        position: fixed;
        bottom: var(--ac-global-dimension-size-600);
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        box-shadow: 8px 8px 20px 0 rgba(0, 0, 0, 0.4);
        border-radius: var(--ac-global-rounding-medium);
        &[data-editing="true"] {
          display: none;
        }
      `}
    >
      <View
        backgroundColor="light"
        padding="size-200"
        borderColor="light"
        borderWidth="thin"
        borderRadius="medium"
        minWidth="size-6000"
      >
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          justifyContent="space-between"
        >
          <Text>Config: &quot;{selectedConfig?.name}&quot;</Text>
          <Flex direction="row" gap="size-100">
            <Button variant="quiet" onPress={onClearSelection}>
              Clear Selection
            </Button>
            <DialogTrigger
              onOpenChange={(open) => {
                setIsEditing(open);
                if (!open) {
                  onClearSelection();
                }
              }}
            >
              <Button variant="danger">
                <Icon svg={<Icons.TrashOutline />} />
                Delete
              </Button>
              <Modal>
                <Dialog
                  css={css`
                    border: none;
                  `}
                >
                  {({ close }) => (
                    <Card
                      title="Delete Annotation Config"
                      bodyStyle={{ padding: 0 }}
                      variant="compact"
                    >
                      <View padding="size-200">
                        <Text>
                          Are you sure you want to delete this annotation
                          config? Annotations made with this config will not be
                          impacted.
                        </Text>
                      </View>
                      <View
                        paddingX="size-200"
                        paddingY="size-100"
                        borderTopColor="dark"
                        borderTopWidth="thin"
                      >
                        <Flex gap="size-100" justifyContent="end">
                          <Button variant="quiet" onPress={close}>
                            Cancel
                          </Button>
                          <Button
                            variant="danger"
                            onPress={() => {
                              if (id) {
                                onDeleteAnnotationConfig(id, {
                                  onCompleted: () => {
                                    close();
                                  },
                                });
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </Flex>
                      </View>
                    </Card>
                  )}
                </Dialog>
              </Modal>
            </DialogTrigger>
            <DialogTrigger
              onOpenChange={(open) => {
                setIsEditing(open);
                if (!open) {
                  onClearSelection();
                }
              }}
            >
              <Button size="S" variant="primary">
                <Icon svg={<Icons.EditOutline />} />
                Edit
              </Button>
              <Modal>
                <AnnotationConfigDialog
                  initialAnnotationConfig={selectedConfig}
                  onAddAnnotationConfig={onEditAnnotationConfig}
                />
              </Modal>
            </DialogTrigger>
          </Flex>
        </Flex>
      </View>
    </div>
  );
};
