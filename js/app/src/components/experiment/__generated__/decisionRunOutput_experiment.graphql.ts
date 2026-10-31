/**
 * @generated SignedSource<<b68e346c9691df011a07c75de02d09d4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type decisionRunOutput_experiment$data = {
  readonly job: {
    readonly taskConfig: {
      readonly __typename: "DecisionTaskConfig";
      readonly questions: ReadonlyArray<{
        readonly __typename: "DecisionChoiceQuestion";
        readonly choices: ReadonlyArray<{
          readonly description: string | null;
          readonly value: string;
        }>;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionPredicateQuestion";
        readonly criteria: {
          readonly false: string | null;
          readonly true: string | null;
        } | null;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionScaleQuestion";
        readonly instructions: string;
        readonly levels: ReadonlyArray<{
          readonly description: string | null;
          readonly label: string;
        }>;
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    } | null;
  } | null;
  readonly " $fragmentType": "decisionRunOutput_experiment";
};
export type decisionRunOutput_experiment$key = {
  readonly " $data"?: decisionRunOutput_experiment$data;
  readonly " $fragmentSpreads": FragmentRefs<"decisionRunOutput_experiment">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "decisionRunOutput_experiment"
};

(node as any).hash = "90ccf7de08ab0682e47b7f5c2aeb500b";

export default node;
