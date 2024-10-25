import React from "react";

import { ActionMenu, Flex, Icon, Icons, Item, Text } from "@arizeai/components";

type AnnotationActionMenuProps = {
  onDelete: () => void;
  isDisabled?: boolean;
};

enum AnnotationAction {
  DELETE = "deleteAnnotation",
}

/**
 * A generic action menu for annotations that can be extended
 */
export function AnnotationActionMenu(props: AnnotationActionMenuProps) {
  const { onDelete, isDisabled = false } = props;

  return (
    <div
      // TODO: add this logic to the ActionMenu component
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ActionMenu
        align="end"
        buttonSize="compact"
        isDisabled={isDisabled}
        onAction={(action) => {
          switch (action) {
            case AnnotationAction.DELETE:
              onDelete();
              break;
          }
        }}
      >
        <Item key={AnnotationAction.DELETE}>
          <Flex
            direction="row"
            gap="size-75"
            justifyContent="start"
            alignItems="center"
          >
            <Icon svg={<Icons.TrashOutline />} />
            <Text>Delete</Text>
          </Flex>
        </Item>
      </ActionMenu>
    </div>
  );
}
