/**
 * @generated SignedSource<<490585b29e52ddb1999f7666034c8287>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type decisionEvaluatorFragment_evaluator$data = {
  readonly decisionVersion: {
    readonly decision: {
      readonly id: string;
      readonly name: string;
    };
    readonly id: string;
    readonly questions: ReadonlyArray<{
      readonly __typename: "DecisionChoiceQuestion";
      readonly choices: ReadonlyArray<{
        readonly value: string;
      }>;
      readonly name: string;
    } | {
      readonly __typename: "DecisionPredicateQuestion";
      readonly name: string;
    } | {
      readonly __typename: "DecisionScaleQuestion";
      readonly levels: ReadonlyArray<{
        readonly label: string;
      }>;
      readonly name: string;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    }>;
  };
  readonly id: string;
  readonly inputSchema: any;
  readonly name: string;
  readonly scoringPolicy: {
    readonly questions: ReadonlyArray<{
      readonly __typename: string;
      readonly includeLabel?: boolean;
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
      readonly scores?: ReadonlyArray<{
        readonly choice: string;
        readonly score: number;
      }>;
      readonly threshold?: number;
    }>;
  };
  readonly " $fragmentType": "decisionEvaluatorFragment_evaluator";
};
export type decisionEvaluatorFragment_evaluator$key = {
  readonly " $data"?: decisionEvaluatorFragment_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"decisionEvaluatorFragment_evaluator">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "decisionEvaluatorFragment_evaluator",
  "selections": [
    (v0/*:: as any*/),
    (v1/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "inputSchema",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionScoringPolicy",
      "kind": "LinkedField",
      "name": "scoringPolicy",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "questions",
          "plural": true,
          "selections": [
            (v2/*:: as any*/),
            (v1/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "optimizationDirection",
              "storageKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "threshold",
                  "storageKey": null
                }
              ],
              "type": "DecisionPredicateScoring",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionChoiceScore",
                  "kind": "LinkedField",
                  "name": "scores",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "choice",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "score",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "type": "DecisionChoiceScoring",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "includeLabel",
                  "storageKey": null
                }
              ],
              "type": "DecisionScaleScoring",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionVersion",
      "kind": "LinkedField",
      "name": "decisionVersion",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "Decision",
          "kind": "LinkedField",
          "name": "decision",
          "plural": false,
          "selections": [
            (v0/*:: as any*/),
            (v1/*:: as any*/)
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "questions",
          "plural": true,
          "selections": [
            (v2/*:: as any*/),
            {
              "kind": "InlineFragment",
              "selections": [
                (v1/*:: as any*/)
              ],
              "type": "DecisionPredicateQuestion",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v1/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionChoiceOption",
                  "kind": "LinkedField",
                  "name": "choices",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "value",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "type": "DecisionChoiceQuestion",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v1/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionScaleLevel",
                  "kind": "LinkedField",
                  "name": "levels",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "label",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "type": "DecisionScaleQuestion",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DecisionEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "bbc40e54999027158e1c5a6c3c5cbd5b";

export default node;
