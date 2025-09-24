import { Suspense, useEffect, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Autocomplete,
  Dialog,
  Flex,
  Label,
  Loading,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import { Checkbox } from "@phoenix/components/checkbox";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { DebouncedSearch } from "@phoenix/components/field/DebouncedSearch";

import type {
  AssignSplitsDialogQuery,
  AssignSplitsDialogQuery$data,
} from "./__generated__/AssignSplitsDialogQuery.graphql";

type AssignSplitsDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedIds: string[]) => void;
  sharedSplitIds: string[];
  partialSplitIds: string[];
};

export function AssignSplitsDialog(props: AssignSplitsDialogProps) {
  const { isOpen, onOpenChange, onConfirm, sharedSplitIds, partialSplitIds } =
    props;
  const [selectedSplitIds, setSelectedSplitIds] = useState<Set<string>>(
    new Set(sharedSplitIds)
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedSplitIds(new Set(sharedSplitIds));
    }
  }, [isOpen, sharedSplitIds]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedSplitIds(new Set());
        }
        onOpenChange(open);
      }}
      isDismissable
    >
      <Modal>
        <Dialog aria-label="Manage Splits">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Splits</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <Suspense fallback={<Loading />}>
              <AssignSplitsDialogContent
                selectedSplitIds={selectedSplitIds}
                setSelectedSplitIds={(s) => setSelectedSplitIds(new Set(s))}
                partialSplitIds={partialSplitIds}
                onConfirm={onConfirm}
              />
            </Suspense>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function AssignSplitsDialogContent(props: {
  selectedSplitIds: Set<string>;
  setSelectedSplitIds: (s: Set<string>) => void;
  onConfirm: (ids: string[]) => void;
  partialSplitIds: string[];
}) {
  const { selectedSplitIds, setSelectedSplitIds, onConfirm, partialSplitIds } =
    props;
  const [search, setSearch] = useState("");
  const query = useLazyLoadQuery<AssignSplitsDialogQuery>(
    graphql`
      query AssignSplitsDialogQuery {
        datasetSplits(first: 200)
          @connection(key: "AssignSplitsDialog_datasetSplits") {
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
      (e: AssignSplitsDialogQuery$data["datasetSplits"]["edges"][number]) =>
        e?.node
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
    </Autocomplete>
  );
}
