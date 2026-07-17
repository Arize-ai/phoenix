/**
 * @generated SignedSource<<dad39c2a45f765b4b68d2755836278f3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvalAttr = "label" | "score";
export type SortDir = "asc" | "desc";
export type SpanColumn = "cumulativeTokenCostTotal" | "cumulativeTokenCountCompletion" | "cumulativeTokenCountPrompt" | "cumulativeTokenCountTotal" | "endTime" | "latencyMs" | "startTime" | "tokenCostTotal" | "tokenCountCompletion" | "tokenCountPrompt" | "tokenCountTotal";
export type SpanSort = {
  col?: SpanColumn | null;
  dir: SortDir;
  evalResultKey?: EvalResultKey | null;
};
export type EvalResultKey = {
  attr: EvalAttr;
  name: string;
};
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type TracesTableQuery$variables = {
  after?: string | null;
  filterCondition?: string | null;
  first?: number | null;
  id: string;
  numDescendants?: number | null;
  sort?: SpanSort | null;
  timeRange?: TimeRange | null;
};
export type TracesTableQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
  };
};
export type TracesTableQuery = {
  response: TracesTableQuery$data;
  variables: TracesTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "after"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterCondition"
},
v2 = {
  "defaultValue": 30,
  "kind": "LocalArgument",
  "name": "first"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v4 = {
  "defaultValue": 50,
  "kind": "LocalArgument",
  "name": "numDescendants"
},
v5 = {
  "defaultValue": {
    "col": "startTime",
    "dir": "desc"
  },
  "kind": "LocalArgument",
  "name": "sort"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v8 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v9 = {
  "kind": "Variable",
  "name": "filterCondition",
  "variableName": "filterCondition"
},
v10 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v11 = {
  "kind": "Variable",
  "name": "sort",
  "variableName": "sort"
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v15 = [
  (v8/*:: as any*/),
  (v9/*:: as any*/),
  (v10/*:: as any*/),
  {
    "kind": "Literal",
    "name": "rootSpansOnly",
    "value": true
  },
  (v11/*:: as any*/),
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusMessage",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v22 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
],
v23 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v22/*:: as any*/),
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v22/*:: as any*/),
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v28 = {
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
    (v27/*:: as any*/)
  ],
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "scoreCount",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "labelCount",
  "storageKey": null
},
v33 = [
  (v28/*:: as any*/),
  (v29/*:: as any*/),
  (v14/*:: as any*/),
  (v30/*:: as any*/),
  (v31/*:: as any*/),
  (v32/*:: as any*/)
],
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v13/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationConfigConnection",
      "kind": "LinkedField",
      "name": "annotationConfigs",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "AnnotationConfigEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v12/*:: as any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "annotationType",
                      "storageKey": null
                    }
                  ],
                  "type": "AnnotationConfigBase",
                  "abstractKey": "__isAnnotationConfigBase"
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v13/*:: as any*/),
                    (v14/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "optimizationDirection",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CategoricalAnnotationValue",
                      "kind": "LinkedField",
                      "name": "values",
                      "plural": true,
                      "selections": [
                        (v27/*:: as any*/),
                        (v34/*:: as any*/)
                      ],
                      "storageKey": null
                    }
                  ],
                  "type": "CategoricalAnnotationConfig",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v13/*:: as any*/)
                  ],
                  "type": "Node",
                  "abstractKey": "__isNode"
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
},
v36 = [
  (v13/*:: as any*/),
  (v14/*:: as any*/),
  (v27/*:: as any*/),
  (v34/*:: as any*/),
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
      (v13/*:: as any*/)
    ],
    "storageKey": null
  }
],
v37 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": (v36/*:: as any*/),
  "storageKey": null
},
v38 = {
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
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      (v6/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TracesTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v7/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": [
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              {
                "kind": "Variable",
                "name": "numDescendants",
                "variableName": "numDescendants"
              },
              (v11/*:: as any*/)
            ],
            "kind": "FragmentSpread",
            "name": "TracesTable_spans"
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
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      (v6/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TracesTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v7/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v12/*:: as any*/),
          (v13/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v14/*:: as any*/),
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
                "name": "traceAnnotationsNames",
                "storageKey": null
              },
              {
                "alias": "rootSpans",
                "args": (v15/*:: as any*/),
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
                          (v13/*:: as any*/),
                          (v16/*:: as any*/),
                          (v14/*:: as any*/),
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
                          (v17/*:: as any*/),
                          (v18/*:: as any*/),
                          (v19/*:: as any*/),
                          (v20/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cumulativeTokenCountTotal",
                            "storageKey": null
                          },
                          (v21/*:: as any*/),
                          (v23/*:: as any*/),
                          (v24/*:: as any*/),
                          (v25/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Trace",
                            "kind": "LinkedField",
                            "name": "trace",
                            "plural": false,
                            "selections": [
                              (v13/*:: as any*/),
                              (v26/*:: as any*/),
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
                                "alias": null,
                                "args": null,
                                "concreteType": "AnnotationSummary",
                                "kind": "LinkedField",
                                "name": "traceAnnotationSummaries",
                                "plural": true,
                                "selections": (v33/*:: as any*/),
                                "storageKey": null
                              },
                              (v35/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "TraceAnnotation",
                                "kind": "LinkedField",
                                "name": "traceAnnotations",
                                "plural": true,
                                "selections": (v36/*:: as any*/),
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v37/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "AnnotationSummary",
                            "kind": "LinkedField",
                            "name": "spanAnnotationSummaries",
                            "plural": true,
                            "selections": (v33/*:: as any*/),
                            "storageKey": null
                          },
                          (v35/*:: as any*/),
                          (v38/*:: as any*/),
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
                                      (v13/*:: as any*/),
                                      (v16/*:: as any*/),
                                      (v14/*:: as any*/),
                                      {
                                        "alias": "statusCode",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "propagatedStatusCode",
                                        "storageKey": null
                                      },
                                      (v17/*:: as any*/),
                                      (v18/*:: as any*/),
                                      (v19/*:: as any*/),
                                      (v20/*:: as any*/),
                                      (v21/*:: as any*/),
                                      {
                                        "alias": "cumulativeTokenCountTotal",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "tokenCountTotal",
                                        "storageKey": null
                                      },
                                      (v23/*:: as any*/),
                                      (v24/*:: as any*/),
                                      (v25/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "Trace",
                                        "kind": "LinkedField",
                                        "name": "trace",
                                        "plural": false,
                                        "selections": [
                                          (v13/*:: as any*/),
                                          (v26/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      (v37/*:: as any*/),
                                      (v35/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "AnnotationSummary",
                                        "kind": "LinkedField",
                                        "name": "spanAnnotationSummaries",
                                        "plural": true,
                                        "selections": [
                                          (v30/*:: as any*/),
                                          (v31/*:: as any*/),
                                          (v32/*:: as any*/),
                                          (v28/*:: as any*/),
                                          (v29/*:: as any*/),
                                          (v14/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      (v38/*:: as any*/)
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
                          (v12/*:: as any*/),
                          (v13/*:: as any*/)
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
              },
              {
                "alias": "rootSpans",
                "args": (v15/*:: as any*/),
                "filters": [
                  "sort",
                  "rootSpansOnly",
                  "filterCondition",
                  "timeRange"
                ],
                "handle": "connection",
                "key": "TracesTable_rootSpans",
                "kind": "LinkedHandle",
                "name": "spans"
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "6bd34d942cc881f76531d75591d0ee61",
    "id": null,
    "metadata": {},
    "name": "TracesTableQuery",
    "operationKind": "query",
    "text": "query TracesTableQuery(\n  $after: String = null\n  $filterCondition: String = null\n  $first: Int = 30\n  $numDescendants: Int = 50\n  $sort: SpanSort = {col: startTime, dir: desc}\n  $timeRange: TimeRange\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...TracesTable_spans_1DScCA\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  spanAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment SpanColumnSelector_annotations on Project {\n  spanAnnotationNames\n}\n\nfragment SpanColumnSelector_traceAnnotations on Project {\n  traceAnnotationsNames\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  traceAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  traceAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment TraceHeaderRootSpanAnnotationsFragment on Span {\n  ...AnnotationSummaryGroup\n}\n\nfragment TracesTable_spans_1DScCA on Project {\n  name\n  ...SpanColumnSelector_annotations\n  ...SpanColumnSelector_traceAnnotations\n  rootSpans: spans(first: $first, after: $after, sort: $sort, rootSpansOnly: true, filterCondition: $filterCondition, timeRange: $timeRange) {\n    edges {\n      rootSpan: node {\n        id\n        spanKind\n        name\n        metadata\n        statusCode\n        statusMessage\n        startTime\n        endTime\n        latencyMs\n        cumulativeTokenCountTotal\n        parentId\n        input {\n          value: truncatedValue\n        }\n        output {\n          value: truncatedValue\n        }\n        spanId\n        trace {\n          id\n          traceId\n          userId\n          numSpans\n          costSummary {\n            total {\n              cost\n            }\n          }\n          traceAnnotationSummaries {\n            labelFractions {\n              fraction\n              label\n            }\n            meanScore\n            name\n          }\n          ...TraceAnnotationSummaryGroup\n        }\n        spanAnnotations {\n          id\n          name\n          label\n          score\n          annotatorKind\n          createdAt\n        }\n        spanAnnotationSummaries {\n          labelFractions {\n            fraction\n            label\n          }\n          meanScore\n          name\n        }\n        ...AnnotationSummaryGroup\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n        descendants(first: $numDescendants) {\n          edges {\n            node {\n              id\n              spanKind\n              name\n              statusCode: propagatedStatusCode\n              statusMessage\n              startTime\n              endTime\n              latencyMs\n              parentId\n              cumulativeTokenCountTotal: tokenCountTotal\n              input {\n                value: truncatedValue\n              }\n              output {\n                value: truncatedValue\n              }\n              spanId\n              trace {\n                id\n                traceId\n              }\n              spanAnnotations {\n                id\n                name\n                label\n                score\n                annotatorKind\n                createdAt\n              }\n              ...AnnotationSummaryGroup\n              documentRetrievalMetrics {\n                evaluationName\n                ndcg\n                precision\n                hit\n              }\n              ...TraceHeaderRootSpanAnnotationsFragment\n            }\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "64a27f91355ebb9c4e53b47d7799d824";

export default node;
