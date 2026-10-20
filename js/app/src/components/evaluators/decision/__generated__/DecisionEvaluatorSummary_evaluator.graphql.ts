/**
 * @generated SignedSource<<fc05b006bbff017debbfecf22d2bb0e4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type DecisionEvaluatorSummary_evaluator$data = {
  readonly decisionVersion: {
    readonly decision: {
      readonly name: string;
    };
    readonly decisionId: string;
    readonly id: string;
    readonly modelName: string;
    readonly modelProvider: GenerativeProviderKey;
    readonly sequenceNumber: number;
  };
  readonly decisionVersionTag: {
    readonly name: string;
  };
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
  readonly " $fragmentType": "DecisionEvaluatorSummary_evaluator";
};
export type DecisionEvaluatorSummary_evaluator$key = {
  readonly " $data"?: DecisionEvaluatorSummary_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionEvaluatorSummary_evaluator">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = [
  (v0/*:: as any*/)
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionEvaluatorSummary_evaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionVersion",
      "kind": "LinkedField",
      "name": "decisionVersion",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "decisionId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "Decision",
          "kind": "LinkedField",
          "name": "decision",
          "plural": false,
          "selections": (v1/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "sequenceNumber",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "modelProvider",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "modelName",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionVersionTag",
      "kind": "LinkedField",
      "name": "decisionVersionTag",
      "plural": false,
      "selections": (v1/*:: as any*/),
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
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "__typename",
              "storageKey": null
            },
            (v0/*:: as any*/),
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
    }
  ],
  "type": "DecisionEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "87afbaf2e86f16eb4cb0f3d8317c5702";

export default node;
