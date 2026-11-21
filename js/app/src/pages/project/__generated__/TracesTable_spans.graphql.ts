/**
 * @generated SignedSource<<765472cd48f0a8d489ea122ac18fe698>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "AGENT" | "CODE" | "DECISION" | "HUMAN" | "LLM";
export type SpanKind = "agent" | "chain" | "decision" | "embedding" | "evaluator" | "guardrail" | "llm" | "prompt" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
import { FragmentRefs } from "relay-runtime";
export type TracesTable_spans$data = {
  readonly id: string;
  readonly name: string;
  readonly rootSpans: {
    readonly edges: ReadonlyArray<{
      readonly rootSpan: {
        readonly cumulativeTokenCountTotal: number | null;
        readonly documentRetrievalMetrics: ReadonlyArray<{
          readonly evaluationName: string;
          readonly hit: number | null;
          readonly ndcg: number | null;
          readonly precision: number | null;
        }>;
        readonly endTime: string | null;
        readonly id: string;
        readonly input: {
          readonly value: string;
        } | null;
        readonly latencyMs: number | null;
        readonly metadata: string | null;
        readonly name: string;
        readonly output: {
          readonly value: string;
        } | null;
        readonly parentId: string | null;
        readonly spanAnnotations: ReadonlyArray<{
          readonly annotatorKind: AnnotatorKind;
          readonly createdAt: string;
          readonly id: string;
          readonly label: string | null;
          readonly name: string;
          readonly score: number | null;
        }>;
        readonly spanId: string;
        readonly spanKind: SpanKind;
        readonly startTime: string;
        readonly statusCode: SpanStatusCode;
        readonly statusMessage: string;
        readonly trace: {
          readonly costSummary: {
            readonly total: {
              readonly cost: number | null;
            };
          };
          readonly id: string;
          readonly numSpans: number;
          readonly traceId: string;
          readonly userId: string | null;
          readonly " $fragmentSpreads": FragmentRefs<"TraceAnnotationSummaryGroup">;
        };
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup" | "TracesTable_descendants">;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationConfigsByNameFragment" | "useSpanAnnotationNames_project">;
  readonly " $fragmentType": "TracesTable_spans";
};
export type TracesTable_spans$key = {
  readonly " $data"?: TracesTable_spans$data;
  readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
};

import TracesTableQuery_graphql from './TracesTableQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "defaultValue": 50,
  "kind": "LocalArgument",
  "name": "numDescendants"
},
v1 = [
  "rootSpans"
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusMessage",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v10 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
],
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v10/*:: as any*/),
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v10/*:: as any*/),
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "label",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "score",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "annotatorKind",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v16 = {
  "args": null,
  "kind": "FragmentSpread",
  "name": "AnnotationSummaryGroup"
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
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": true,
      "kind": "LocalArgument",
      "name": "deferChildSpans"
    },
    {
      "defaultValue": 30,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": true,
      "kind": "LocalArgument",
      "name": "includeAnnotationNames"
    },
    (v0/*:: as any*/),
    {
      "defaultValue": {
        "col": "startTime",
        "dir": "desc"
      },
      "kind": "LocalArgument",
      "name": "sort"
    },
    {
      "kind": "RootArgument",
      "name": "timeRange"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "traceFilterCondition"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v1/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v1/*:: as any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": TracesTableQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "TracesTable_spans",
  "selections": [
    (v2/*:: as any*/),
    (v3/*:: as any*/),
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ProjectAnnotationConfigsByNameFragment"
    },
    {
      "condition": "includeAnnotationNames",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "kind": "Defer",
          "selections": [
            {
              "kind": "InlineDataFragmentSpread",
              "name": "useSpanAnnotationNames_project",
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "spanAnnotationNames",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "traceAnnotationNames",
                  "storageKey": null
                }
              ],
              "args": null,
              "argumentDefinitions": []
            }
          ]
        }
      ]
    },
    {
      "alias": "rootSpans",
      "args": [
        {
          "kind": "Literal",
          "name": "filterCondition",
          "value": "parent_span is None"
        },
        {
          "kind": "Variable",
          "name": "sort",
          "variableName": "sort"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        },
        {
          "kind": "Variable",
          "name": "traceFilterCondition",
          "variableName": "traceFilterCondition"
        }
      ],
      "concreteType": "SpanConnection",
      "kind": "LinkedField",
      "name": "__TracesTable_rootSpans_connection",
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
                (v2/*:: as any*/),
                (v4/*:: as any*/),
                (v3/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "metadata",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "statusCode",
                  "storageKey": null
                },
                (v5/*:: as any*/),
                (v6/*:: as any*/),
                (v7/*:: as any*/),
                (v8/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "cumulativeTokenCountTotal",
                  "storageKey": null
                },
                (v9/*:: as any*/),
                (v11/*:: as any*/),
                (v12/*:: as any*/),
                (v13/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Trace",
                  "kind": "LinkedField",
                  "name": "trace",
                  "plural": false,
                  "selections": [
                    (v2/*:: as any*/),
                    (v14/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "userId",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "numSpans",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanCostSummary",
                      "kind": "LinkedField",
                      "name": "costSummary",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "CostBreakdown",
                          "kind": "LinkedField",
                          "name": "total",
                          "plural": false,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "cost",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    },
                    {
                      "args": null,
                      "kind": "FragmentSpread",
                      "name": "TraceAnnotationSummaryGroup"
                    }
                  ],
                  "storageKey": null
                },
                (v15/*:: as any*/),
                (v16/*:: as any*/),
                (v17/*:: as any*/),
                {
                  "kind": "Defer",
                  "selections": [
                    {
                      "kind": "InlineDataFragmentSpread",
                      "name": "TracesTable_descendants",
                      "selections": [
                        {
                          "alias": null,
                          "args": [
                            {
                              "kind": "Variable",
                              "name": "first",
                              "variableName": "numDescendants"
                            }
                          ],
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
                                    (v2/*:: as any*/),
                                    (v4/*:: as any*/),
                                    (v3/*:: as any*/),
                                    {
                                      "alias": "statusCode",
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "propagatedStatusCode",
                                      "storageKey": null
                                    },
                                    (v5/*:: as any*/),
                                    (v6/*:: as any*/),
                                    (v7/*:: as any*/),
                                    (v8/*:: as any*/),
                                    (v9/*:: as any*/),
                                    {
                                      "alias": "cumulativeTokenCountTotal",
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "tokenCountTotal",
                                      "storageKey": null
                                    },
                                    (v11/*:: as any*/),
                                    (v12/*:: as any*/),
                                    (v13/*:: as any*/),
                                    {
                                      "alias": null,
                                      "args": null,
                                      "concreteType": "Trace",
                                      "kind": "LinkedField",
                                      "name": "trace",
                                      "plural": false,
                                      "selections": [
                                        (v2/*:: as any*/),
                                        (v14/*:: as any*/)
                                      ],
                                      "storageKey": null
                                    },
                                    (v15/*:: as any*/),
                                    (v16/*:: as any*/),
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
                      "args": [
                        {
                          "kind": "Variable",
                          "name": "numDescendants",
                          "variableName": "numDescendants"
                        }
                      ],
                      "argumentDefinitions": [
                        (v0/*:: as any*/)
                      ]
                    }
                  ]
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "Span",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
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
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
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
};
})();

(node as any).hash = "856131ee740b3db055c5b00c12a41f3e";

export default node;
