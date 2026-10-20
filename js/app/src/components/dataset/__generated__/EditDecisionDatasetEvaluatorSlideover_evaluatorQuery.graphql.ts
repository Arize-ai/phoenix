/**
 * @generated SignedSource<<8a6319640df83b92437fce8510c340fe>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type EditDecisionDatasetEvaluatorSlideover_evaluatorQuery$variables = {
  datasetEvaluatorId: string;
  datasetId: string;
};
export type EditDecisionDatasetEvaluatorSlideover_evaluatorQuery$data = {
  readonly dataset: {
    readonly datasetEvaluator?: {
      readonly description: string | null;
      readonly evaluator: {
        readonly __typename: string;
        readonly datasetEvaluators?: ReadonlyArray<{
          readonly id: string;
        }>;
        readonly decisionVersion?: {
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
          readonly sequenceNumber: number;
        };
        readonly id: string;
        readonly inputSchema?: any;
        readonly name: string;
        readonly scoringPolicy?: {
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
      };
      readonly id: string;
      readonly inputMapping: {
        readonly literalMapping: any;
        readonly pathMapping: any;
      };
      readonly name: string;
    };
  };
};
export type EditDecisionDatasetEvaluatorSlideover_evaluatorQuery = {
  response: EditDecisionDatasetEvaluatorSlideover_evaluatorQuery$data;
  variables: EditDecisionDatasetEvaluatorSlideover_evaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetEvaluatorId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "datasetEvaluatorId",
          "variableName": "datasetEvaluatorId"
        }
      ],
      "concreteType": "DatasetEvaluator",
      "kind": "LinkedField",
      "name": "datasetEvaluator",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
        (v4/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "description",
          "storageKey": null
        },
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
          "concreteType": null,
          "kind": "LinkedField",
          "name": "evaluator",
          "plural": false,
          "selections": [
            (v5/*:: as any*/),
            (v3/*:: as any*/),
            (v4/*:: as any*/),
            {
              "kind": "InlineFragment",
              "selections": [
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
                  "concreteType": "DatasetEvaluator",
                  "kind": "LinkedField",
                  "name": "datasetEvaluators",
                  "plural": true,
                  "selections": [
                    (v3/*:: as any*/)
                  ],
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
                        (v5/*:: as any*/),
                        (v4/*:: as any*/),
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
                    (v3/*:: as any*/),
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
                      "concreteType": "Decision",
                      "kind": "LinkedField",
                      "name": "decision",
                      "plural": false,
                      "selections": [
                        (v3/*:: as any*/),
                        (v4/*:: as any*/)
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
                        (v5/*:: as any*/),
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v4/*:: as any*/)
                          ],
                          "type": "DecisionPredicateQuestion",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
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
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDecisionDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EditDecisionDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          (v6/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "972469734145c6646466106a78f49c5e",
    "id": null,
    "metadata": {},
    "name": "EditDecisionDatasetEvaluatorSlideover_evaluatorQuery",
    "operationKind": "query",
    "text": "query EditDecisionDatasetEvaluatorSlideover_evaluatorQuery(\n  $datasetId: ID!\n  $datasetEvaluatorId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        id\n        name\n        description\n        inputMapping {\n          literalMapping\n          pathMapping\n        }\n        evaluator {\n          __typename\n          id\n          name\n          ... on DecisionEvaluator {\n            inputSchema\n            datasetEvaluators {\n              id\n            }\n            scoringPolicy {\n              questions {\n                __typename\n                name\n                optimizationDirection\n                ... on DecisionPredicateScoring {\n                  threshold\n                }\n                ... on DecisionChoiceScoring {\n                  scores {\n                    choice\n                    score\n                  }\n                }\n                ... on DecisionScaleScoring {\n                  includeLabel\n                }\n              }\n            }\n            decisionVersion {\n              id\n              sequenceNumber\n              decision {\n                id\n                name\n              }\n              questions {\n                __typename\n                ... on DecisionPredicateQuestion {\n                  name\n                }\n                ... on DecisionChoiceQuestion {\n                  name\n                  choices {\n                    value\n                  }\n                }\n                ... on DecisionScaleQuestion {\n                  name\n                  levels {\n                    label\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "b5c7d420b6a62f9ac6450cb8e0dbef01";

export default node;
