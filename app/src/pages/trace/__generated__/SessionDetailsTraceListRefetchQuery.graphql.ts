/**
 * @generated SignedSource<<9accc406a7e4c41c0a302fdd9550e089>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionDetailsTraceListRefetchQuery$variables = {
  after?: string | null;
  first?: number | null;
  id: string;
};
export type SessionDetailsTraceListRefetchQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"SessionDetailsTraceList_traces">;
  };
};
export type SessionDetailsTraceListRefetchQuery = {
  response: SessionDetailsTraceListRefetchQuery$data;
  variables: SessionDetailsTraceListRefetchQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": 50,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationType",
  "storageKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "CategoricalAnnotationValue",
  "kind": "LinkedField",
  "name": "values",
  "plural": true,
  "selections": [
    (v9/*:: as any*/),
    (v10/*:: as any*/)
  ],
  "storageKey": null
},
v12 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mimeType",
    "storageKey": null
  }
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v18 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "count",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "scoreCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "labelCount",
    "storageKey": null
  },
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
      (v9/*:: as any*/)
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
  (v5/*:: as any*/)
],
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "identifier",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionDetailsTraceListRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v2/*:: as any*/),
            "kind": "FragmentSpread",
            "name": "SessionDetailsTraceList_traces"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SessionDetailsTraceListRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "numTraces",
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v2/*:: as any*/),
                "concreteType": "TraceConnection",
                "kind": "LinkedField",
                "name": "traces",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "TraceEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "trace",
                        "args": null,
                        "concreteType": "Trace",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v4/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "traceId",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "errorCount",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "rootSpan",
                            "plural": false,
                            "selections": [
                              (v4/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "attributes",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Project",
                                "kind": "LinkedField",
                                "name": "project",
                                "plural": false,
                                "selections": [
                                  (v4/*:: as any*/),
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
                                              (v3/*:: as any*/),
                                              {
                                                "kind": "InlineFragment",
                                                "selections": [
                                                  (v5/*:: as any*/),
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "kind": "ScalarField",
                                                    "name": "description",
                                                    "storageKey": null
                                                  },
                                                  (v6/*:: as any*/),
                                                  (v7/*:: as any*/),
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v8/*:: as any*/),
                                                      (v11/*:: as any*/)
                                                    ],
                                                    "type": "CategoricalAnnotationConfig",
                                                    "abstractKey": null
                                                  },
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "lowerBound",
                                                        "storageKey": null
                                                      },
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "upperBound",
                                                        "storageKey": null
                                                      },
                                                      (v8/*:: as any*/)
                                                    ],
                                                    "type": "ContinuousAnnotationConfig",
                                                    "abstractKey": null
                                                  },
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v8/*:: as any*/),
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "threshold",
                                                        "storageKey": null
                                                      }
                                                    ],
                                                    "type": "FreeformAnnotationConfig",
                                                    "abstractKey": null
                                                  }
                                                ],
                                                "type": "AnnotationConfigBase",
                                                "abstractKey": "__isAnnotationConfigBase"
                                              },
                                              (v7/*:: as any*/)
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
                                "concreteType": "SpanIOValue",
                                "kind": "LinkedField",
                                "name": "input",
                                "plural": false,
                                "selections": (v12/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanIOValue",
                                "kind": "LinkedField",
                                "name": "output",
                                "plural": false,
                                "selections": (v12/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "cumulativeTokenCountTotal",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "latencyMs",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "startTime",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "endTime",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Trace",
                                "kind": "LinkedField",
                                "name": "trace",
                                "plural": false,
                                "selections": [
                                  (v4/*:: as any*/),
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
                                    "concreteType": "Project",
                                    "kind": "LinkedField",
                                    "name": "project",
                                    "plural": false,
                                    "selections": [
                                      (v4/*:: as any*/),
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
                                                  (v3/*:: as any*/),
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v6/*:: as any*/)
                                                    ],
                                                    "type": "AnnotationConfigBase",
                                                    "abstractKey": "__isAnnotationConfigBase"
                                                  },
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v4/*:: as any*/),
                                                      (v5/*:: as any*/),
                                                      (v8/*:: as any*/),
                                                      (v11/*:: as any*/)
                                                    ],
                                                    "type": "CategoricalAnnotationConfig",
                                                    "abstractKey": null
                                                  },
                                                  (v7/*:: as any*/)
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
                                    "concreteType": "TraceAnnotation",
                                    "kind": "LinkedField",
                                    "name": "traceAnnotations",
                                    "plural": true,
                                    "selections": [
                                      (v4/*:: as any*/),
                                      (v5/*:: as any*/),
                                      (v9/*:: as any*/),
                                      (v10/*:: as any*/),
                                      (v13/*:: as any*/),
                                      (v14/*:: as any*/),
                                      (v15/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "User",
                                        "kind": "LinkedField",
                                        "name": "user",
                                        "plural": false,
                                        "selections": [
                                          (v16/*:: as any*/),
                                          (v17/*:: as any*/),
                                          (v4/*:: as any*/)
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
                                    "selections": (v18/*:: as any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": "viewerUserFeedbackAnnotations",
                                    "args": [
                                      {
                                        "kind": "Literal",
                                        "name": "filter",
                                        "value": {
                                          "include": {
                                            "names": [
                                              "user_feedback"
                                            ]
                                          }
                                        }
                                      }
                                    ],
                                    "concreteType": "TraceAnnotation",
                                    "kind": "LinkedField",
                                    "name": "traceAnnotations",
                                    "plural": true,
                                    "selections": [
                                      (v4/*:: as any*/),
                                      (v9/*:: as any*/),
                                      (v19/*:: as any*/)
                                    ],
                                    "storageKey": "traceAnnotations(filter:{\"include\":{\"names\":[\"user_feedback\"]}})"
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanAnnotation",
                                "kind": "LinkedField",
                                "name": "spanAnnotations",
                                "plural": true,
                                "selections": [
                                  (v4/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v5/*:: as any*/),
                                      (v9/*:: as any*/),
                                      (v10/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "explanation",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "metadata",
                                        "storageKey": null
                                      },
                                      (v13/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "source",
                                        "storageKey": null
                                      },
                                      (v19/*:: as any*/),
                                      (v14/*:: as any*/),
                                      (v15/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "User",
                                        "kind": "LinkedField",
                                        "name": "user",
                                        "plural": false,
                                        "selections": [
                                          (v4/*:: as any*/),
                                          (v16/*:: as any*/),
                                          (v17/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      {
                                        "kind": "TypeDiscriminator",
                                        "abstractKey": "__isNode"
                                      }
                                    ],
                                    "type": "Annotation",
                                    "abstractKey": "__isAnnotation"
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "AnnotationSummary",
                                "kind": "LinkedField",
                                "name": "spanAnnotationSummaries",
                                "plural": true,
                                "selections": (v18/*:: as any*/),
                                "storageKey": null
                              },
                              (v5/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "spanId",
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
                        "concreteType": "Trace",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/)
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
                "alias": null,
                "args": (v2/*:: as any*/),
                "filters": null,
                "handle": "connection",
                "key": "SessionDetailsTraceList_traces",
                "kind": "LinkedHandle",
                "name": "traces"
              }
            ],
            "type": "ProjectSession",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3b3d3b9306633fc8fe5a3eb131343b42",
    "id": null,
    "metadata": {},
    "name": "SessionDetailsTraceListRefetchQuery",
    "operationKind": "query",
    "text": "query SessionDetailsTraceListRefetchQuery(\n  $after: String = null\n  $first: Int = 50\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...SessionDetailsTraceList_traces_2HEEH6\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  id\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ...ConnectedDetailPanelAnnotationBarConfigFields\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    ...ConnectedDetailPanelAnnotationBarAnnotationFields\n    id\n  }\n  spanAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment ConnectedDetailPanelAnnotationBarAnnotationFields on Annotation {\n  __isAnnotation: __typename\n  ... on Node {\n    __isNode: __typename\n    id\n  }\n  name\n  label\n  score\n  explanation\n  metadata\n  annotatorKind\n  source\n  identifier\n  createdAt\n  updatedAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n}\n\nfragment ConnectedDetailPanelAnnotationBarConfigFields on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  __typename\n  ... on Node {\n    __isNode: __typename\n    id\n  }\n  name\n  description\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    lowerBound\n    upperBound\n    optimizationDirection\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n  }\n}\n\nfragment SessionDetailsTraceList_traces_2HEEH6 on ProjectSession {\n  numTraces\n  traces(first: $first, after: $after) {\n    edges {\n      trace: node {\n        id\n        traceId\n        errorCount\n        rootSpan {\n          ...TraceTurnContent_rootSpan\n          trace {\n            costSummary {\n              total {\n                cost\n              }\n            }\n            id\n          }\n          id\n          name\n          input {\n            truncatedValue\n            mimeType\n          }\n          output {\n            truncatedValue\n            mimeType\n          }\n          cumulativeTokenCountTotal\n          latencyMs\n          startTime\n          spanId\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  traceAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  traceAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment TraceFeedbackActionToolbar_trace on Trace {\n  id\n  viewerUserFeedbackAnnotations: traceAnnotations(filter: {include: {names: [\"user_feedback\"]}}) {\n    id\n    label\n    identifier\n  }\n}\n\nfragment TraceTurnContent_rootSpan on Span {\n  id\n  attributes\n  project {\n    id\n  }\n  input {\n    value\n  }\n  output {\n    value\n  }\n  cumulativeTokenCountTotal\n  latencyMs\n  startTime\n  endTime\n  trace {\n    id\n    costSummary {\n      total {\n        cost\n      }\n    }\n    ...TraceAnnotationSummaryGroup\n    ...TraceFeedbackActionToolbar_trace\n  }\n  ...AnnotationSummaryGroup\n}\n"
  }
};
})();

(node as any).hash = "7ca19594521e6c03b537d75599269dea";

export default node;
