import React from "react";
import { Dialog, DialogTrigger } from "react-aria-components";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  ListBox,
  ListBoxItem,
  Popover,
  PopoverArrow,
  SelectChevronUpDownIcon,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";
import { ProjectSort } from "@phoenix/pages/projects/__generated__/ProjectsPageProjectsQuery.graphql";

const SortedListBoxItemContent = ({
  children,
  direction,
  isSelected,
}: {
  children: React.ReactNode;
  direction?: "asc" | "desc";
  isSelected: boolean;
}) => {
  return (
    <Flex
      direction="row"
      alignItems="center"
      gap="size-100"
      justifyContent="space-between"
      width="100%"
    >
      {children}
      {direction && direction === "asc" && isSelected && (
        <Icon svg={<Icons.ChevronUp />} />
      )}
      {direction && direction === "desc" && isSelected && (
        <Icon svg={<Icons.ChevronDown />} />
      )}
      {/* blank icon to prevent layout shift when direction is not set */}
      {!direction || (!isSelected && <Icon svg={<svg />} />)}
    </Flex>
  );
};

export const ProjectSortMenu = ({
  onSort,
}: {
  onSort?: (sort: ProjectSort) => void;
}) => {
  const { projectSortOrder, setProjectSortOrder } = usePreferencesContext(
    (state) => ({
      projectSortOrder: state.projectSortOrder,
      setProjectSortOrder: state.setProjectSortOrder,
    })
  );
  return (
    <DialogTrigger>
      <Button size="S" leadingVisual={<Icon svg={<Icons.Grid />} />}>
        Sort
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <PopoverArrow />
        <Dialog>
          <ListBox
            selectionMode="single"
            selectionBehavior="replace"
            selectedKeys={[projectSortOrder.column]}
            onSelectionChange={(keys) => {
              let column: string;
              if (typeof keys === "string") {
                column = keys;
              } else if (keys.size === 0) {
                column = projectSortOrder.column;
              } else {
                column = keys.values().next().value;
              }
              let direction = projectSortOrder.direction;
              if (column === projectSortOrder.column) {
                direction = direction === "asc" ? "desc" : "asc";
              } else {
                direction = "asc";
              }
              onSort?.({
                col: column as "name" | "createdAt" | "updatedAt",
                dir: direction,
              });
              setProjectSortOrder({
                column: column as "name" | "createdAt" | "updatedAt",
                direction,
              });
            }}
            css={css`
              & > .react-aria-ListBoxItem {
                padding-right: var(--ac-global-dimension-static-size-50);
              }
            `}
          >
            <ListBoxItem id="name">
              <SortedListBoxItemContent
                direction={projectSortOrder.direction}
                isSelected={projectSortOrder.column === "name"}
              >
                Name
              </SortedListBoxItemContent>
            </ListBoxItem>
            <ListBoxItem id="createdAt">
              <SortedListBoxItemContent
                direction={projectSortOrder.direction}
                isSelected={projectSortOrder.column === "createdAt"}
              >
                Created At
              </SortedListBoxItemContent>
            </ListBoxItem>
            <ListBoxItem id="updatedAt">
              <SortedListBoxItemContent
                direction={projectSortOrder.direction}
                isSelected={projectSortOrder.column === "updatedAt"}
              >
                Updated At
              </SortedListBoxItemContent>
            </ListBoxItem>
          </ListBox>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
