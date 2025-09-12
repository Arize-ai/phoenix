import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { css } from "@emotion/react";

import {
  Autocomplete,
  Button,
  ColorSwatch,
  DebouncedSearch,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  ListBox,
  ListBoxItem,
  Loading,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";
import { PromptLabelConfigButton_labels$key } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButton_labels.graphql";
import { PromptLabelConfigButtonQuery } from "@phoenix/pages/prompt/__generated__/PromptLabelConfigButtonQuery.graphql";

import { NewPromptLabelDialog } from "./NewPromptLabelDialog";

export function PromptLabelConfigButton() {
  const [showNewLabelDialog, setShowNewLabelDialog] = useState<boolean>(false);
  return (
    <>
      <DialogTrigger>
        <Button
          variant="quiet"
          size="S"
          leadingVisual={
            <Icon svg={<Icon svg={<Icons.SettingsOutline />} />} />
          }
          aria-label="Edit prompt labels"
        />
        <Popover>
          <PopoverArrow />
          <Dialog>
            <Suspense fallback={<Loading />}>
              <PromptLabelSelectionDialogContent
                onNewLabelPress={() => {
                  setShowNewLabelDialog(true);
                }}
              />
            </Suspense>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {showNewLabelDialog ? <NewPromptLabelDialog /> : null}
    </>
  );
}

function PromptLabelSelectionDialogContent(props: {
  onNewLabelPress: () => void;
}) {
  const query = useLazyLoadQuery<PromptLabelConfigButtonQuery>(
    graphql`
      query PromptLabelConfigButtonQuery {
        ...PromptLabelConfigButton_labels
      }
    `,
    {}
  );
  return <PromptLabelList query={query} {...props} />;
}
function PromptLabelList({
  query,
  onNewLabelPress,
}: {
  query: PromptLabelConfigButton_labels$key;
  onNewLabelPress: () => void;
}) {
  const [search, setSearch] = useState("");

  const [data] = useRefetchableFragment(
    graphql`
      fragment PromptLabelConfigButton_labels on Query
      @refetchable(queryName: "PromptLabelConfigButtonLabelsQuery") {
        promptLabels {
          edges {
            node {
              id
              name
              color
            }
          }
        }
      }
    `,
    query
  );
  const labels = data.promptLabels.edges
    .map((edge) => edge.node)
    .filter((label) => {
      return label.name.toLowerCase().includes(search);
    });
  return (
    <Autocomplete>
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderColor="dark"
        minWidth={300}
      >
        <Flex direction="column" gap="size-50">
          <Flex direction="row" justifyContent="space-between">
            <Heading level={4} weight="heavy">
              Assign labels to this prompt
            </Heading>
            <IconButton size="S" onPress={onNewLabelPress}>
              <Icon svg={<Icons.PlusOutline />} />
            </IconButton>
          </Flex>
          <DebouncedSearch
            autoFocus
            aria-label="Search labels"
            placeholder="Search labels..."
            onChange={setSearch}
          />
        </Flex>
      </View>
      <ListBox
        aria-label="labels"
        items={labels}
        selectionMode="multiple"
        css={css`
          height: 300px;
        `}
        onSelectionChange={(selection) => {
          if (selection === "all") {
            return;
          }
          //const labelId = selection.keys().next().value;
        }}
        renderEmptyState={() => "No labels found"}
      >
        {(item) => (
          <ListBoxItem key={item.id} id={item.id}>
            <Flex direction="row" gap="size-100" alignItems="center">
              <ColorSwatch color={item.color} size="M" shape="circle" />
              {item.name}
            </Flex>
          </ListBoxItem>
        )}
      </ListBox>
    </Autocomplete>
  );
}
