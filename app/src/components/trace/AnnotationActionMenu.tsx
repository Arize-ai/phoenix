import { ActionMenu, ActionMenuProps, Item } from "@arizeai/components";

import { Flex, Icon, Icons, Text } from "@phoenix/components";

export type AnnotationActionMenuProps = Pick<
  ActionMenuProps<AnnotationAction>,
  "buttonVariant" | "buttonSize" | "isDisabled"
> & {
  onDelete: () => void;
};

enum AnnotationAction {
  DELETE = "deleteAnnotation",
}

/**
 * A generic action menu for annotations that can be extended
 */
export function AnnotationActionMenu(props: AnnotationActionMenuProps) {
  const {
    onDelete,
    isDisabled = false,
    buttonVariant = "quiet",
    buttonSize = "compact",
  } = props;

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
        buttonVariant={buttonVariant}
        buttonSize={buttonSize}
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
