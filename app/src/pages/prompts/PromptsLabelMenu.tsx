import { css } from "@emotion/react";
import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Autocomplete,
  Button,
  Icon,
  Icons,
  Input,
  Loading,
  Menu,
  MenuEmpty,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  Token,
  useFilter,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";
import type { PromptsLabelMenuQuery } from "@phoenix/pages/prompts/__generated__/PromptsLabelMenuQuery.graphql";

type PromptsLabelMenuProps = {
  onSelectionChange: (labelIds: string[]) => void;
  selectedLabelIds: string[];
};

/**
 * The PromptsLabelMenu is a menu that allows the user to filter prompts by labels.
 * Currently supports filtering mode only, with room for future "add" mode functionality.
 */
export const PromptsLabelMenu = ({
  onSelectionChange,
  selectedLabelIds,
}: PromptsLabelMenuProps) => {
  return (
    <MenuTrigger>
      <Button leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}>
        Labels
        {selectedLabelIds.length > 0 ? ` (${selectedLabelIds.length})` : ""}
      </Button>
      <Popover placement="bottom end">
        <Suspense
          fallback={
            <Loading
              css={css`
                min-width: 300px;
                min-height: 200px;
              `}
            />
          }
        >
          <LabelMenuFilterContent
            selectedLabelIds={selectedLabelIds}
            onSelectionChange={onSelectionChange}
          />
        </Suspense>
      </Popover>
    </MenuTrigger>
  );
};

/**
 * The LabelMenuFilterContent displays a multi-select menu of labels for filtering prompts.
 */
const LabelMenuFilterContent = ({
  selectedLabelIds,
  onSelectionChange,
}: {
  selectedLabelIds: string[];
  onSelectionChange: (labelIds: string[]) => void;
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const data = useLazyLoadQuery<PromptsLabelMenuQuery>(
    graphql`
      query PromptsLabelMenuQuery {
        promptLabels(first: 100) {
          edges {
            label: node {
              id
              name
              color
            }
          }
        }
      }
    `,
    {},
    // fetch when menu is opened, but show cache data first to prevent flickering
    { fetchPolicy: "store-and-network" }
  );

  const labels = useMemo(() => {
    return data.promptLabels.edges.map((edge) => edge.label);
  }, [data]);

  return (
    <Autocomplete filter={contains}>
      <MenuHeader>
        <SearchField aria-label="Search" variant="quiet" autoFocus>
          <SearchIcon />
          <Input placeholder="Search labels" />
        </SearchField>
      </MenuHeader>
      <Menu
        items={labels}
        selectionMode="multiple"
        renderEmptyState={() => <MenuEmpty>No labels found</MenuEmpty>}
        selectedKeys={selectedLabelIds}
        onSelectionChange={(keys) => {
          if (keys === "all") {
            onSelectionChange(labels.map((l) => l.id));
          } else {
            onSelectionChange(Array.from(keys as Set<string>));
          }
        }}
      >
        {({ id, name, color }) => (
          <MenuItem id={id} textValue={name}>
            <Token color={color ?? undefined}>{name}</Token>
          </MenuItem>
        )}
      </Menu>
    </Autocomplete>
  );
};
