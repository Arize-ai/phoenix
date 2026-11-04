import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  useRelayEnvironment,
} from "react-relay";

import { Alert, CompositeField, Loading } from "@phoenix/components";
import { DecisionVersionSelector } from "@phoenix/pages/playground/DecisionVersionSelector";
import { sourceMenuContainerCSS } from "@phoenix/pages/playground/searchablePickerStyles";

import type { DecisionVersionPickerDecisionsQuery } from "./__generated__/DecisionVersionPickerDecisionsQuery.graphql";
import type { DecisionVersionPickerVersionQuery } from "./__generated__/DecisionVersionPickerVersionQuery.graphql";
import { DecisionMenu, type DecisionMenuItem } from "./DecisionMenu";
import type { DecisionQuestionDefinition } from "./decisionPolicyUtils";
import { toDecisionQuestionDefinitions } from "./decisionPolicyUtils";

/** A decision version chosen in the picker, with what a binding needs from it. */
export type DecisionVersionSelection = {
  decisionId: string;
  decisionName: string;
  versionId: string;
  /** The tag the version was picked by, if any. */
  tagName: string | null;
  /** The version's questions, in declared order. */
  questions: DecisionQuestionDefinition[];
  /** The variables the version's templates use, in first-appearance order. */
  variables: string[];
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
          variables
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
 * decision picks its latest version. The decision menu is drawn like the
 * playground's prompt menu and the version menu is its
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
      if (!decision?.version || !decision.id || !decision.name) {
        setError("That decision version could not be loaded.");
        return;
      }
      onChange({
        decisionId: decision.id,
        decisionName: decision.name,
        versionId: decision.version.id,
        tagName: version.tagName ?? null,
        questions: toDecisionQuestionDefinitions(decision.version.questions),
        variables: [...decision.version.variables],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the version.");
    }
  };

  const selectedDecision = value
    ? { id: value.decisionId, name: value.decisionName }
    : null;
  const menu = (
    <Suspense fallback={<Loading size="S" />}>
      <SavedDecisionMenu
        selectedDecision={selectedDecision}
        isDisabled={isDisabled}
        onSelectDecision={(decisionId) => select(decisionId, {})}
      />
    </Suspense>
  );
  return (
    <div css={pickerCSS}>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <div css={sourceMenuContainerCSS}>
        {value && !isDisabled ? (
          <CompositeField>
            {menu}
            <DecisionVersionSelector
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
          </CompositeField>
        ) : (
          menu
        )}
      </div>
    </div>
  );
}

const pickerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  min-width: 0;
`;

function SavedDecisionMenu({
  selectedDecision,
  isDisabled,
  onSelectDecision,
}: {
  selectedDecision: DecisionMenuItem | null;
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
    <DecisionMenu
      decisions={data.decisions.edges.map(({ decision }) => decision)}
      selectedDecision={selectedDecision}
      isDisabled={isDisabled}
      onSelectDecision={(decisionId) => {
        if (decisionId !== selectedDecision?.id) {
          onSelectDecision(decisionId);
        }
      }}
    />
  );
}
