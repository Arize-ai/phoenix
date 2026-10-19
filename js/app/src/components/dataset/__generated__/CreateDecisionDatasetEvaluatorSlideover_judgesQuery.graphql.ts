/**
 * @generated SignedSource<<1e70d685882f4eeee5cfab29acc04b82>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type CreateDecisionDatasetEvaluatorSlideover_judgesQuery$variables = Record<PropertyKey, never>;
export type CreateDecisionDatasetEvaluatorSlideover_judgesQuery$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly judge: {
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
        readonly projectionPolicy?: {
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
export type CreateDecisionDatasetEvaluatorSlideover_judgesQuery = {
  response: CreateDecisionDatasetEvaluatorSlideover_judgesQuery$data;
  variables: CreateDecisionDatasetEvaluatorSlideover_judgesQuery$variables;
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
            "alias": "judge",
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
                    "concreteType": "DecisionProjectionPolicy",
                    "kind": "LinkedField",
                    "name": "projectionPolicy",
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
    "name": "CreateDecisionDatasetEvaluatorSlideover_judgesQuery",
    "selections": (v3/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "CreateDecisionDatasetEvaluatorSlideover_judgesQuery",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "ed90a87bc1a7a35544a91ebfce753543",
    "id": null,
    "metadata": {},
    "name": "CreateDecisionDatasetEvaluatorSlideover_judgesQuery",
    "operationKind": "query",
    "text": "query CreateDecisionDatasetEvaluatorSlideover_judgesQuery {\n  evaluators(first: 200) {\n    edges {\n      judge: node {\n        __typename\n        id\n        name\n        ... on DecisionEvaluator {\n          inputSchema\n          projectionPolicy {\n            questions {\n              __typename\n              name\n              optimizationDirection\n              ... on DecisionPredicateProjection {\n                threshold\n              }\n              ... on DecisionChoiceProjection {\n                scores {\n                  choice\n                  score\n                }\n              }\n              ... on DecisionScaleProjection {\n                includeLabel\n              }\n            }\n          }\n          decisionVersion {\n            id\n            sequenceNumber\n            decision {\n              id\n              name\n            }\n            questions {\n              __typename\n              ... on DecisionPredicateQuestion {\n                name\n              }\n              ... on DecisionChoiceQuestion {\n                name\n                choices {\n                  value\n                }\n              }\n              ... on DecisionScaleQuestion {\n                name\n                levels {\n                  label\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4b8cf562f70aab059cb99feadb1305a5";

export default node;
