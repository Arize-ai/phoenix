/**
 * @generated SignedSource<<404a468e274332426a598d292e532443>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery$variables = Record<PropertyKey, never>;
export type CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly evaluator: {
        readonly __typename: string;
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
    }>;
  };
};
export type CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery = {
  response: CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery$data;
  variables: CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "first",
        "value": 200
      }
    ],
    "concreteType": "EvaluatorConnection",
    "kind": "LinkedField",
    "name": "evaluators",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "EvaluatorEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "evaluator",
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v0/*:: as any*/),
              (v1/*:: as any*/),
              (v2/*:: as any*/),
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
                          (v0/*:: as any*/),
                          (v2/*:: as any*/),
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
                      (v1/*:: as any*/),
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
                          (v1/*:: as any*/),
                          (v2/*:: as any*/)
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
                          (v0/*:: as any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v2/*:: as any*/)
                            ],
                            "type": "DecisionPredicateQuestion",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v2/*:: as any*/),
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
                              (v2/*:: as any*/),
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
    "storageKey": "evaluators(first:200)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery",
    "selections": (v3/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "79b94d8d6babb7ad708f56c8ac3e5825",
    "id": null,
    "metadata": {},
    "name": "CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery",
    "operationKind": "query",
    "text": "query CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery {\n  evaluators(first: 200) {\n    edges {\n      evaluator: node {\n        __typename\n        id\n        name\n        ... on DecisionEvaluator {\n          inputSchema\n          scoringPolicy {\n            questions {\n              __typename\n              name\n              optimizationDirection\n              ... on DecisionPredicateScoring {\n                threshold\n              }\n              ... on DecisionChoiceScoring {\n                scores {\n                  choice\n                  score\n                }\n              }\n              ... on DecisionScaleScoring {\n                includeLabel\n              }\n            }\n          }\n          decisionVersion {\n            id\n            sequenceNumber\n            decision {\n              id\n              name\n            }\n            questions {\n              __typename\n              ... on DecisionPredicateQuestion {\n                name\n              }\n              ... on DecisionChoiceQuestion {\n                name\n                choices {\n                  value\n                }\n              }\n              ... on DecisionScaleQuestion {\n                name\n                levels {\n                  label\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "705f8b4ed10ecdfdf94a6af88fe1463b";

export default node;
