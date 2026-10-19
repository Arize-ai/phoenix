import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  useRelayEnvironment,
} from "react-relay";

import {
  Alert,
  Button,
  Flex,
  Label,
  ListBox,
  Loading,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";
import { DecisionVersionSelector } from "@phoenix/pages/playground/DecisionVersionSelector";

import type { DecisionVersionPickerDecisionsQuery } from "./__generated__/DecisionVersionPickerDecisionsQuery.graphql";
import type { DecisionVersionPickerVersionQuery } from "./__generated__/DecisionVersionPickerVersionQuery.graphql";
import type { DecisionQuestionDefinition } from "./decisionPolicyUtils";
import { toDecisionQuestionDefinitions } from "./decisionPolicyUtils";

/** A declared decision input. */
export type DecisionInputDefinition = {
  name: string;
  description: string | null;
};

/** A decision version chosen in the picker, with what a binding needs from it. */
export type DecisionVersionSelection = {
  decisionId: string;
  decisionName: string;
  versionId: string;
  /** The version's number within its decision, shown as "v{n}". */
  sequenceNumber: number;
  /** The tag the version was picked by, if any. */
  tagName: string | null;
  /** The version's questions, in declared order. */
  questions: DecisionQuestionDefinition[];
  /** The inputs the version declares, in declared order. */
  inputs: DecisionInputDefinition[];
};

export type DecisionVersionPickerProps = {
  /** The current selection, or null when nothing is picked. */
  value: DecisionVersionSelection | null;
  /**
   * Called with the full selection after the user picks a decision (its
   * latest version) or another version or tag of the selected decision.
   */
  onChange: (selection: DecisionVersionSelection) => void;
  isDisabled?: boolean;
};

const versionQuery = graphql`
  query DecisionVersionPickerVersionQuery(
    $decisionId: ID!
    $versionId: ID
    $tagName: Identifier
  ) {
    decision: node(id: $decisionId) {
      ... on Decision {
        id
        name
        version(versionId: $versionId, tagName: $tagName) {
          id
          sequenceNumber
          inputs {
            name
            description
          }
          questions {
            __typename
            ... on DecisionPredicateQuestion {
              name
            }
            ... on DecisionChoiceQuestion {
              name
              choices {
                value
              }
            }
            ... on DecisionScaleQuestion {
              name
              levels {
                label
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Picks a saved decision, then one of its versions or tags. Selecting a
 * decision picks its latest version. The version menu is the playground's
 * {@link DecisionVersionSelector}.
 */
export function DecisionVersionPicker({
  value,
  onChange,
  isDisabled,
}: DecisionVersionPickerProps) {
  const environment = useRelayEnvironment();
  const [error, setError] = useState<string | null>(null);

  const select = async (
    decisionId: string,
    version: { versionId?: string; tagName?: string }
  ) => {
    setError(null);
    try {
      const data = await fetchQuery<DecisionVersionPickerVersionQuery>(
        environment,
        versionQuery,
        {
          decisionId,
          versionId: version.versionId ?? null,
          tagName: version.tagName ?? null,
        },
        { fetchPolicy: "network-only" }
      ).toPromise();
      const decision = data?.decision;
      if (!decision?.version || !decision.id || decision.name == null) {
        setError("That decision version could not be loaded.");
        return;
      }
      onChange({
        decisionId: decision.id,
        decisionName: decision.name,
        versionId: decision.version.id,
        sequenceNumber: decision.version.sequenceNumber,
        tagName: version.tagName ?? null,
        questions: toDecisionQuestionDefinitions(decision.version.questions),
        inputs: decision.version.inputs.map(({ name, description }) => ({
          name,
          description: description ?? null,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the version.");
    }
  };

  return (
    <Flex direction="column" gap="size-100">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Flex direction="row" gap="size-100" alignItems="end">
        <Suspense fallback={<Loading />}>
          <DecisionSelect
            selectedDecisionId={value?.decisionId ?? null}
            isDisabled={isDisabled}
            onSelectDecision={(decisionId) => select(decisionId, {})}
          />
        </Suspense>
        {value && !isDisabled ? (
          <DecisionVersionSelector
            sequenceNumber={value.sequenceNumber}
            decision={{
              id: value.decisionId,
              name: value.decisionName,
              versionId: value.versionId,
              tag: value.tagName,
            }}
            onSelectVersion={(versionId) =>
              select(value.decisionId, { versionId })
            }
            onSelectTag={(tagName) => select(value.decisionId, { tagName })}
          />
        ) : null}
      </Flex>
    </Flex>
  );
}

function DecisionSelect({
  selectedDecisionId,
  isDisabled,
  onSelectDecision,
}: {
  selectedDecisionId: string | null;
  isDisabled?: boolean;
  onSelectDecision: (decisionId: string) => void;
}) {
  const data = useLazyLoadQuery<DecisionVersionPickerDecisionsQuery>(
    graphql`
      query DecisionVersionPickerDecisionsQuery {
        decisions(first: 200) {
          edges {
            decision: node {
              id
              name
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  return (
    <Select
      aria-label="Decision"
      placeholder="Select a decision"
      isDisabled={isDisabled}
      value={selectedDecisionId}
      onChange={(key) => {
        if (key != null && key !== selectedDecisionId) {
          onSelectDecision(String(key));
        }
      }}
      data-testid="decision-version-picker-decision-select"
      css={css`
        flex: 1 1 auto;
        min-width: 0;
      `}
    >
      <Label>Decision</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {data.decisions.edges.map(({ decision }) => (
            <SelectItem
              key={decision.id}
              id={decision.id}
              textValue={decision.name}
            >
              {decision.name}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
