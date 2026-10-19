/**
 * @generated SignedSource<<8619458e431146571d4e92abea0e3480>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type DecisionDatasetEvaluatorDetails_datasetEvaluator$data = {
  readonly decisionProjectionPolicy: {
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
  } | null;
  readonly evaluator: {
    readonly __typename: "DecisionEvaluator";
    readonly decisionVersion: {
      readonly decisionId: string;
      readonly id: string;
      readonly inputs: ReadonlyArray<{
        readonly description: string | null;
        readonly name: string;
      }>;
      readonly modelName: string;
      readonly modelProvider: GenerativeProviderKey;
      readonly questions: ReadonlyArray<{
        readonly __typename: "DecisionChoiceQuestion";
        readonly choices: ReadonlyArray<{
          readonly value: string;
        }>;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionPredicateQuestion";
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionScaleQuestion";
        readonly instructions: string;
        readonly levels: ReadonlyArray<{
          readonly label: string;
        }>;
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly sequenceNumber: number;
    };
    readonly decisionVersionTag: {
      readonly name: string;
    };
    readonly projectionPolicy: {
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
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly id: string;
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly name: string;
  readonly " $fragmentType": "DecisionDatasetEvaluatorDetails_datasetEvaluator";
};
export type DecisionDatasetEvaluatorDetails_datasetEvaluator$key = {
  readonly " $data"?: DecisionDatasetEvaluatorDetails_datasetEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionDatasetEvaluatorDetails_datasetEvaluator">;
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
},
v3 = [
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
        "type": "DecisionPredicateProjection",
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
        "type": "DecisionChoiceProjection",
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
        "type": "DecisionScaleProjection",
        "abstractKey": null
      }
    ],
    "storageKey": null
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionDatasetEvaluatorDetails_datasetEvaluator",
  "selections": [
    (v0/*:: as any*/),
    (v1/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorInputMapping",
      "kind": "LinkedField",
      "name": "inputMapping",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "literalMapping",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "pathMapping",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionProjectionPolicy",
      "kind": "LinkedField",
      "name": "decisionProjectionPolicy",
      "plural": false,
      "selections": (v3/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "evaluator",
      "plural": false,
      "selections": [
        (v2/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionProjectionPolicy",
              "kind": "LinkedField",
              "name": "projectionPolicy",
              "plural": false,
              "selections": (v3/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionVersionTag",
              "kind": "LinkedField",
              "name": "decisionVersionTag",
              "plural": false,
              "selections": [
                (v1/*:: as any*/)
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
                  "kind": "ScalarField",
                  "name": "decisionId",
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
                  "name": "modelName",
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
                  "concreteType": "DecisionInputDefinition",
                  "kind": "LinkedField",
                  "name": "inputs",
                  "plural": true,
                  "selections": [
                    (v1/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "description",
                      "storageKey": null
                    }
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
                        (v1/*:: as any*/),
                        (v4/*:: as any*/)
                      ],
                      "type": "DecisionPredicateQuestion",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*:: as any*/),
                        (v4/*:: as any*/),
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
                        (v4/*:: as any*/),
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DatasetEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "db7da09c19b18cbd6dc2a2b28c58ac86";

export default node;
