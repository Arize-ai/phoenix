import { Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Autocomplete,
  Button,
  Dialog,
  Flex,
  Label,
  Loading,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import { Checkbox } from "@phoenix/components/checkbox";
import { NewDatasetSplitDialog } from "@phoenix/components/dataset/NewDatasetSplitDialog";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { DebouncedSearch } from "@phoenix/components/field/DebouncedSearch";

import type {
  ManageDatasetSplitsDialogQuery,
  ManageDatasetSplitsDialogQuery$data,
} from "./__generated__/ManageDatasetSplitsDialogQuery.graphql";

interface SelectedExample {
  id: string;
  splits: readonly {
    readonly id: string;
    readonly color: string;
    readonly name: string;
  }[];
}

type ManageDatasetSplitsDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedIds: string[]) => void;
  selectedExamples: SelectedExample[];
};

export function ManageDatasetSplitsDialog(
  props: ManageDatasetSplitsDialogProps
) {
  const { isOpen, onOpenChange, onConfirm, selectedExamples } = props;

  // Calculate shared split IDs (splits that all selected examples have)
  const sharedSplitIds = useMemo<string[]>(() => {
    if (selectedExamples.length === 0) return [];
    const splitIdArrays = selectedExamples.map(
      (ex) => ex.splits.map((s) => s.id) ?? []
    );
    const intersection = splitIdArrays.reduce((acc, curr) =>
      acc.filter((id) => curr.includes(id))
    );
    return intersection;
  }, [selectedExamples]);

  // Calculate partial split IDs (splits that at least one selected example has)
  const partialSplitIds = useMemo<string[]>(() => {
    if (selectedExamples.length === 0) return [];
    const splitIdArrays = selectedExamples
      .map((ex) => ex.splits.map((s) => s.id) ?? [])
      .reduce((acc, curr) => acc.concat(curr), []);
    return [...new Set(splitIdArrays)];
  }, [selectedExamples]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
      }}
      isDismissable
    >
      <Modal size="S">
        <Dialog aria-label="Manage Splits">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Splits</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <Suspense fallback={<Loading />}>
              {/* isOpen && is being used to reduce flickering of the dialog
      , however it is a code smell */}
              {isOpen ? (
                <ManageDatasetSplitsDialogContent
                  key={`${Number(isOpen)}-${JSON.stringify(sharedSplitIds)}`}
                  sharedSplitIds={sharedSplitIds}
                  partialSplitIds={partialSplitIds}
                  selectedExamples={selectedExamples}
                  onConfirm={onConfirm}
                />
              ) : null}
            </Suspense>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function ManageDatasetSplitsDialogContent(props: {
  sharedSplitIds: string[];
  partialSplitIds: string[];
  selectedExamples: SelectedExample[];
  onConfirm: (ids: string[]) => void;
}) {
  const { sharedSplitIds, partialSplitIds, onConfirm, selectedExamples } =
    props;
  const [search, setSearch] = useState("");
  const [isCreateSplitOpen, setIsCreateSplitOpen] = useState(false);
  const [selectedSplitIds, setSelectedSplitIds] = useState<Set<string>>(
    () => new Set(sharedSplitIds)
  );
  const query = useLazyLoadQuery<ManageDatasetSplitsDialogQuery>(
    graphql`
      query ManageDatasetSplitsDialogQuery {
        datasetSplits(first: 200)
          @connection(key: "ManageDatasetSplitsDialog_datasetSplits") {
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
    {}
  );
  const allSplits = (query.datasetSplits?.edges ?? [])
    .map(
      (
        e: ManageDatasetSplitsDialogQuery$data["datasetSplits"]["edges"][number]
      ) => e?.node
    )
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    color?: string | null;
  }>;
  const splits = useMemo(
    () =>
      allSplits.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
      ),
    [allSplits, search]
  );
  const partial = new Set(partialSplitIds);

  return (
    <Autocomplete>
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderColor="dark"
        minWidth={300}
      >
        <Flex direction="column" gap="size-50">
          <Label>Select splits</Label>
          <DebouncedSearch
            aria-label="Search splits"
            placeholder="Search splits..."
            onChange={setSearch}
          />
        </Flex>
      </View>
      <View
        css={css`
          max-height: 300px;
          overflow: auto;
          min-width: 300px;
        `}
        padding="size-100"
      >
        <div>
          {splits.map((split) => {
            const isPartial = partial.has(split.id);
            const isSelected = selectedSplitIds.has(split.id);
            return (
              <label
                key={split.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <Checkbox
                  isSelected={isSelected}
                  isIndeterminate={!isSelected && isPartial}
                  onChange={(checked) => {
                    const next = new Set(selectedSplitIds);
                    if (checked) {
                      next.add(split.id);
                    } else {
                      next.delete(split.id);
                    }
                    setSelectedSplitIds(next);
                    onConfirm(Array.from(next));
                  }}
                >
                  {split.name}
                </Checkbox>
              </label>
            );
          })}
        </div>
      </View>
      <View padding="size-100" borderTopColor="dark" borderTopWidth="thin">
        <Button
          variant="quiet"
          size="S"
          style={{ width: "100%" }}
          onPress={() => setIsCreateSplitOpen(true)}
        >
          Create Split
        </Button>
      </View>
      <ModalOverlay
        isOpen={isCreateSplitOpen}
        onOpenChange={(open) => {
          if (!open) setIsCreateSplitOpen(false);
        }}
      >
        <NewDatasetSplitDialog
          onCompleted={() => setIsCreateSplitOpen(false)}
          exampleIds={selectedExamples.map((example) => example.id)}
        />
      </ModalOverlay>
    </Autocomplete>
  );
}
