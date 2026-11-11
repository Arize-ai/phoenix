/**
 * @generated SignedSource<<e5f600cc037eda4cd4ffbc5acd134d6f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotatorKind = "AGENT" | "CODE" | "DECISION" | "HUMAN" | "LLM";
export type TracesTableChildSpanDetailsQuery$variables = {
  numDescendants: number;
  projectId: string;
  rootSpanCount: number;
  rootSpanFilterCondition: string;
};
export type TracesTableChildSpanDetailsQuery$data = {
  readonly project: {
    readonly rootSpans?: {
      readonly edges: ReadonlyArray<{
        readonly rootSpan: {
          readonly descendants: {
            readonly edges: ReadonlyArray<{
              readonly node: {
                readonly documentRetrievalMetrics: ReadonlyArray<{
                  readonly evaluationName: string;
                  readonly hit: number | null;
                  readonly ndcg: number | null;
                  readonly precision: number | null;
                }>;
                readonly id: string;
                readonly input: {
                  readonly value: string;
                } | null;
                readonly output: {
                  readonly value: string;
                } | null;
                readonly spanAnnotations: ReadonlyArray<{
                  readonly annotatorKind: AnnotatorKind;
                  readonly createdAt: string;
                  readonly id: string;
                  readonly label: string | null;
                  readonly name: string;
                  readonly score: number | null;
                }>;
                readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
              };
            }>;
          };
          readonly id: string;
        };
      }>;
    };
  };
};
export type TracesTableChildSpanDetailsQuery = {
  response: TracesTableChildSpanDetailsQuery$data;
  variables: TracesTableChildSpanDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "numDescendants"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "rootSpanCount"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "rootSpanFilterCondition"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v5 = [
  {
    "kind": "Variable",
    "name": "filterCondition",
    "variableName": "rootSpanFilterCondition"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "rootSpanCount"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "numDescendants"
  },
  {
    "kind": "Literal",
    "name": "maxDepth",
    "value": 3
  }
],
v8 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
],
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v8/*:: as any*/),
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v8/*:: as any*/),
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": [
    (v6/*:: as any*/),
    (v11/*:: as any*/),
    (v12/*:: as any*/),
    (v13/*:: as any*/),
    (v14/*:: as any*/),
    (v15/*:: as any*/)
  ],
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "DocumentRetrievalMetrics",
  "kind": "LinkedField",
  "name": "documentRetrievalMetrics",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ndcg",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "precision",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hit",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v19 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "exclude": {
        "names": [
          "note"
        ]
      }
    }
  }
],
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TracesTableChildSpanDetailsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": "rootSpans",
                "args": (v5/*:: as any*/),
                "concreteType": "SpanConnection",
                "kind": "LinkedField",
                "name": "spans",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "rootSpan",
                        "args": null,
                        "concreteType": "Span",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v6/*:: as any*/),
                          {
                            "alias": null,
                            "args": (v7/*:: as any*/),
                            "concreteType": "SpanConnection",
                            "kind": "LinkedField",
                            "name": "descendants",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanEdge",
                                "kind": "LinkedField",
                                "name": "edges",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "Span",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      (v6/*:: as any*/),
                                      (v9/*:: as any*/),
                                      (v10/*:: as any*/),
                                      (v16/*:: as any*/),
                                      {
                                        "args": null,
                                        "kind": "FragmentSpread",
                                        "name": "AnnotationSummaryGroup"
                                      },
                                      (v17/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
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
      (v3/*:: as any*/),
      (v2/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TracesTableChildSpanDetailsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v18/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": "rootSpans",
                "args": (v5/*:: as any*/),
                "concreteType": "SpanConnection",
                "kind": "LinkedField",
                "name": "spans",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "rootSpan",
                        "args": null,
                        "concreteType": "Span",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v6/*:: as any*/),
                          {
                            "alias": null,
                            "args": (v7/*:: as any*/),
                            "concreteType": "SpanConnection",
                            "kind": "LinkedField",
                            "name": "descendants",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanEdge",
                                "kind": "LinkedField",
                                "name": "edges",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "Span",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      (v6/*:: as any*/),
                                      (v9/*:: as any*/),
                                      (v10/*:: as any*/),
                                      (v16/*:: as any*/),
                                      {
                                        "alias": "summarySpanAnnotations",
                                        "args": (v19/*:: as any*/),
                                        "concreteType": "SpanAnnotation",
                                        "kind": "LinkedField",
                                        "name": "spanAnnotations",
                                        "plural": true,
                                        "selections": [
                                          (v6/*:: as any*/),
                                          (v11/*:: as any*/),
                                          (v12/*:: as any*/),
                                          (v13/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "explanation",
                                            "storageKey": null
                                          },
                                          (v14/*:: as any*/),
                                          (v15/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "updatedAt",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "User",
                                            "kind": "LinkedField",
                                            "name": "user",
                                            "plural": false,
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "username",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "profilePictureUrl",
                                                "storageKey": null
                                              },
                                              (v6/*:: as any*/)
                                            ],
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "DecisionAnnotation",
                                            "kind": "LinkedField",
                                            "name": "decision",
                                            "plural": false,
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "status",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": "DecisionAnnotationQuestion",
                                                "kind": "LinkedField",
                                                "name": "question",
                                                "plural": false,
                                                "selections": [
                                                  (v11/*:: as any*/),
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "kind": "ScalarField",
                                                    "name": "type",
                                                    "storageKey": null
                                                  },
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "concreteType": "DecisionChoiceOption",
                                                    "kind": "LinkedField",
                                                    "name": "choices",
                                                    "plural": true,
                                                    "selections": [
                                                      (v20/*:: as any*/),
                                                      (v21/*:: as any*/)
                                                    ],
                                                    "storageKey": null
                                                  },
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "concreteType": "DecisionScaleLevel",
                                                    "kind": "LinkedField",
                                                    "name": "levels",
                                                    "plural": true,
                                                    "selections": [
                                                      (v12/*:: as any*/),
                                                      (v21/*:: as any*/)
                                                    ],
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
                                                "name": "answer",
                                                "plural": false,
                                                "selections": [
                                                  (v18/*:: as any*/),
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v22/*:: as any*/)
                                                    ],
                                                    "type": "PredicateAnswer",
                                                    "abstractKey": null
                                                  },
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "choice",
                                                        "storageKey": null
                                                      },
                                                      (v23/*:: as any*/),
                                                      {
                                                        "alias": "choiceProbabilities",
                                                        "args": null,
                                                        "concreteType": "ChoiceProbability",
                                                        "kind": "LinkedField",
                                                        "name": "probabilities",
                                                        "plural": true,
                                                        "selections": [
                                                          (v20/*:: as any*/),
                                                          (v22/*:: as any*/)
                                                        ],
                                                        "storageKey": null
                                                      }
                                                    ],
                                                    "type": "ChoiceAnswer",
                                                    "abstractKey": null
                                                  },
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "expectedLevel",
                                                        "storageKey": null
                                                      },
                                                      (v23/*:: as any*/),
                                                      {
                                                        "alias": "levelProbabilities",
                                                        "args": null,
                                                        "concreteType": "LevelProbability",
                                                        "kind": "LinkedField",
                                                        "name": "probabilities",
                                                        "plural": true,
                                                        "selections": [
                                                          {
                                                            "alias": null,
                                                            "args": null,
                                                            "kind": "ScalarField",
                                                            "name": "level",
                                                            "storageKey": null
                                                          },
                                                          (v22/*:: as any*/)
                                                        ],
                                                        "storageKey": null
                                                      }
                                                    ],
                                                    "type": "ScaleAnswer",
                                                    "abstractKey": null
                                                  }
                                                ],
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "requestedModel",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "resolvedModel",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "modelProvider",
                                                "storageKey": null
                                              }
                                            ],
                                            "storageKey": null
                                          }
                                        ],
                                        "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                                      },
                                      {
                                        "alias": "summarySpanAnnotationSummaries",
                                        "args": (v19/*:: as any*/),
                                        "concreteType": "AnnotationSummary",
                                        "kind": "LinkedField",
                                        "name": "spanAnnotationSummaries",
                                        "plural": true,
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "LabelFraction",
                                            "kind": "LinkedField",
                                            "name": "labelFractions",
                                            "plural": true,
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "fraction",
                                                "storageKey": null
                                              },
                                              (v12/*:: as any*/)
                                            ],
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "meanScore",
                                            "storageKey": null
                                          },
                                          (v11/*:: as any*/)
                                        ],
                                        "storageKey": "spanAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                                      },
                                      (v17/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "51933717dc9999d61db3b04091bb2522",
    "id": null,
    "metadata": {},
    "name": "TracesTableChildSpanDetailsQuery",
    "operationKind": "query",
    "text": "query TracesTableChildSpanDetailsQuery(\n  $projectId: ID!\n  $rootSpanFilterCondition: String!\n  $rootSpanCount: Int!\n  $numDescendants: Int!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      rootSpans: spans(first: $rootSpanCount, filterCondition: $rootSpanFilterCondition) {\n        edges {\n          rootSpan: node {\n            id\n            descendants(first: $numDescendants, maxDepth: 3) {\n              edges {\n                node {\n                  id\n                  input {\n                    value: truncatedValue\n                  }\n                  output {\n                    value: truncatedValue\n                  }\n                  spanAnnotations {\n                    id\n                    name\n                    label\n                    score\n                    annotatorKind\n                    createdAt\n                  }\n                  ...AnnotationSummaryGroup\n                  documentRetrievalMetrics {\n                    evaluationName\n                    ndcg\n                    precision\n                    hit\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  summarySpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n    decision {\n      status\n      question {\n        name\n        type\n        choices {\n          value\n          description\n        }\n        levels {\n          label\n          description\n        }\n      }\n      answer {\n        __typename\n        ... on PredicateAnswer {\n          probability\n        }\n        ... on ChoiceAnswer {\n          choice\n          confidence\n          choiceProbabilities: probabilities {\n            value\n            probability\n          }\n        }\n        ... on ScaleAnswer {\n          expectedLevel\n          confidence\n          levelProbabilities: probabilities {\n            level\n            probability\n          }\n        }\n      }\n      requestedModel\n      resolvedModel\n      modelProvider\n    }\n  }\n  summarySpanAnnotationSummaries: spanAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "7bf804e5b6375eed2d1d9b9e26694c7b";

export default node;
