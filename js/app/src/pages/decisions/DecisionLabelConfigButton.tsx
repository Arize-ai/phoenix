import { Suspense, useMemo, useState } from "react";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";

import {
  Alert,
  Autocomplete,
  Button,
  ColorSwatch,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Input,
  LinkButton,
  Loading,
  Menu,
  MenuFooter,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  Popover,
  PopoverArrow,
  SearchField,
  type Selection,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import { NewLabelForm } from "@phoenix/components/label";
import type { DecisionLabelConfigButton_allLabels$key } from "@phoenix/pages/decisions/__generated__/DecisionLabelConfigButton_allLabels.graphql";
import type { DecisionLabelConfigButton_decisionLabels$key } from "@phoenix/pages/decisions/__generated__/DecisionLabelConfigButton_decisionLabels.graphql";
import type { DecisionLabelConfigButtonUnsetLabelsMutation } from "@phoenix/pages/decisions/__generated__/DecisionLabelConfigButtonUnsetLabelsMutation.graphql";
import { useDecisionLabelMutations } from "@phoenix/pages/decisions/useDecisionLabelMutations";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DecisionLabelConfigButtonQuery } from "./__generated__/DecisionLabelConfigButtonQuery.graphql";
import type { DecisionLabelConfigButtonSetLabelsMutation } from "./__generated__/DecisionLabelConfigButtonSetLabelsMutation.graphql";

type DecisionLabelConfigButtonProps = {
  decisionId: string;
};

export function DecisionLabelConfigButton(
  props: DecisionLabelConfigButtonProps
) {
  const { decisionId } = props;
  return (
    <DialogTrigger>
      <Button
        variant="quiet"
        size="S"
        leadingVisual={<Icon svg={<Icons.Settings />} />}
        aria-label="Edit decision labels"
      />
      <Popover
        placement="bottom start"
        shouldCloseOnInteractOutside={() => true}
      >
        <PopoverArrow />
        <Dialog>
          <Suspense fallback={<Loading />}>
            <DecisionLabelSelectionContent decisionId={decisionId} />
          </Suspense>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/**
 * A self-contained label selection control for a decision, suitable for rendering
 * inside a popover (e.g. from a table row action menu). It supports applying
 * existing labels and creating a new label inline, mirroring the datasets list
 * experience ({@link DatasetLabelSelectionContent}).
 */
export function DecisionLabelSelectionContent(props: { decisionId: string }) {
  const { decisionId } = props;
  const query = useLazyLoadQuery<DecisionLabelConfigButtonQuery>(
    graphql`
      query DecisionLabelConfigButtonQuery($decisionId: ID!) {
        ...DecisionLabelConfigButton_allLabels
        decision: node(id: $decisionId) {
          ... on Decision {
            ...DecisionLabelConfigButton_decisionLabels
          }
        }
      }
    `,
    { decisionId }
  );

  return <DecisionLabelList query={query} decision={query.decision} />;
}

function DecisionLabelList({
  query,
  decision,
}: {
  decision: DecisionLabelConfigButton_decisionLabels$key;
  query: DecisionLabelConfigButton_allLabels$key;
}) {
  const [mode, setMode] = useState<"apply" | "create">("apply");
  const [error, setError] = useState<string | null>(null);
  const { contains } = useFilter({ sensitivity: "base" });
  const decisionData =
    useFragment<DecisionLabelConfigButton_decisionLabels$key>(
      graphql`
        fragment DecisionLabelConfigButton_decisionLabels on Decision {
          id
          labels {
            id
          }
        }
      `,
      decision
    );
  const labelData = useFragment<DecisionLabelConfigButton_allLabels$key>(
    graphql`
      fragment DecisionLabelConfigButton_allLabels on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 100 }) {
        decisionLabels(first: $first)
          @connection(
            key: "DecisionLabelConfigButtonAllLabels_decisionLabels"
          ) {
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

  const selectedLabelIds = useMemo(
    () => decisionData?.labels?.map((label) => label.id) ?? [],
    [decisionData?.labels]
  );
  // Derive selected state directly from Relay data - no need for separate state
  const selected = useMemo(() => new Set(selectedLabelIds), [selectedLabelIds]);

  const labels = useMemo(
    () => labelData.decisionLabels.edges.map((edge) => edge.node),
    [labelData]
  );

  const [setDecisionLabels] =
    useMutation<DecisionLabelConfigButtonSetLabelsMutation>(graphql`
      mutation DecisionLabelConfigButtonSetLabelsMutation(
        $decisionId: ID!
        $decisionLabelIds: [ID!]!
      ) {
        setDecisionLabels(
          input: {
            decisionId: $decisionId
            decisionLabelIds: $decisionLabelIds
          }
        ) {
          query {
            node(id: $decisionId) {
              ... on Decision {
                ...DecisionLabelConfigButton_decisionLabels
              }
            }
          }
        }
      }
    `);
  const [unsetDecisionLabels] =
    useMutation<DecisionLabelConfigButtonUnsetLabelsMutation>(graphql`
      mutation DecisionLabelConfigButtonUnsetLabelsMutation(
        $decisionId: ID!
        $decisionLabelIds: [ID!]!
      ) {
        unsetDecisionLabels(
          input: {
            decisionId: $decisionId
            decisionLabelIds: $decisionLabelIds
          }
        ) {
          query {
            node(id: $decisionId) {
              ... on Decision {
                ...DecisionLabelConfigButton_decisionLabels
              }
            }
          }
        }
      }
    `);

  const onError = (error: Error) => {
    const formattedError = getErrorMessagesFromRelayMutationError(error);
    setError(formattedError?.[0] ?? error.message);
  };

  const onSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }
    const newLabelIds = [...selection] as string[];
    const labelIdsToAdd = newLabelIds.filter(
      (id) => !selectedLabelIds.includes(id)
    );
    const labelIdsToRemove = selectedLabelIds.filter(
      (id) => !newLabelIds.includes(id)
    );

    if (labelIdsToAdd.length) {
      setDecisionLabels({
        variables: {
          decisionId: decisionData.id,
          decisionLabelIds: labelIdsToAdd,
        },
        onError,
      });
    }
    if (labelIdsToRemove.length) {
      unsetDecisionLabels({
        variables: {
          decisionId: decisionData.id,
          decisionLabelIds: labelIdsToRemove,
        },
        onError,
      });
    }
  };

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <MenuHeader>
        <MenuHeaderTitle
          leadingContent={
            mode === "create" ? (
              <Button
                variant="quiet"
                size="S"
                aria-label="Back to labels"
                leadingVisual={<Icon svg={<Icons.ChevronLeftSmall />} />}
                onPress={() => setMode("apply")}
              />
            ) : undefined
          }
          trailingContent={
            mode === "apply" ? (
              <Button
                variant="quiet"
                size="S"
                aria-label="Create new label"
                leadingVisual={<Icon svg={<Icons.Plus />} />}
                onPress={() => setMode("create")}
              />
            ) : undefined
          }
        >
          {mode === "create" ? "Create New Label" : "Assign labels"}
        </MenuHeaderTitle>
      </MenuHeader>
      {mode === "apply" && (
        <>
          <Autocomplete filter={contains}>
            <MenuHeader>
              <SearchField aria-label="Search labels" variant="quiet" autoFocus>
                <SearchIcon />
                <Input placeholder="Search labels..." />
              </SearchField>
            </MenuHeader>
            <Menu
              aria-label="labels"
              items={labels}
              selectionMode="multiple"
              selectedKeys={selected}
              onSelectionChange={onSelectionChange}
              renderEmptyState={() => (
                <CompactEmptyState
                  icon={<Icon svg={<Icons.PriceTags />} />}
                  description="No labels"
                />
              )}
            >
              {({ id, name, color }) => (
                <MenuItem
                  id={id}
                  textValue={name}
                  leadingContent={
                    <ColorSwatch
                      color={color ?? undefined}
                      size="M"
                      shape="circle"
                    />
                  }
                >
                  {name}
                </MenuItem>
              )}
            </Menu>
          </Autocomplete>
          <MenuFooter>
            <LinkButton variant="quiet" size="S" to="/settings/decisions">
              Edit Labels
            </LinkButton>
          </MenuFooter>
        </>
      )}
      {mode === "create" && (
        <CreateNewDecisionLabel onCompleted={() => setMode("apply")} />
      )}
    </>
  );
}

function CreateNewDecisionLabel({ onCompleted }: { onCompleted: () => void }) {
  const { addLabelMutation, isSubmitting, error } = useDecisionLabelMutations();
  return (
    <>
      {error && (
        <Alert banner variant="danger">
          {error}
        </Alert>
      )}
      <NewLabelForm
        onSubmit={(label) => addLabelMutation(label, onCompleted)}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
