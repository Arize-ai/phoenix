/**
 * @generated SignedSource<<1cd2f0315549d2dad75b01dfcdd81686>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionDetailsTracesViewSelectedTraceQuery$variables = {
  projectId: string;
  traceId: string;
};
export type SessionDetailsTracesViewSelectedTraceQuery$data = {
  readonly project: {
    readonly trace?: {
      readonly id: string;
      readonly rootSpans: {
        readonly edges: ReadonlyArray<{
          readonly span: {
            readonly cumulativeTokenCountTotal: number | null;
            readonly id: string;
            readonly latencyMs: number | null;
            readonly spanId: string;
            readonly startTime: string;
            readonly trace: {
              readonly costSummary: {
                readonly total: {
                  readonly cost: number | null;
                };
              };
            };
            readonly " $fragmentSpreads": FragmentRefs<"TraceTurnContent_rootSpan">;
          };
        }>;
      };
      readonly traceId: string;
    } | null;
  };
};
export type SessionDetailsTracesViewSelectedTraceQuery = {
  response: SessionDetailsTracesViewSelectedTraceQuery$data;
  variables: SessionDetailsTracesViewSelectedTraceQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "traceId",
    "variableName": "traceId"
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
  "name": "traceId",
  "storageKey": null
},
v5 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 1
  },
  {
    "kind": "Literal",
    "name": "orphanSpanAsRootSpan",
    "value": true
  },
  {
    "kind": "Literal",
    "name": "rootSpansOnly",
    "value": true
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountTotal",
  "storageKey": null
},
v10 = {
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
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationType",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "CategoricalAnnotationValue",
  "kind": "LinkedField",
  "name": "values",
  "plural": true,
  "selections": [
    (v15/*:: as any*/),
    (v16/*:: as any*/)
  ],
  "storageKey": null
},
v18 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v24 = [
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
      (v15/*:: as any*/)
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
  (v13/*:: as any*/)
],
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "identifier",
  "storageKey": null
},
v26 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionDetailsTracesViewSelectedTraceQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v2/*:: as any*/),
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
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
                            "alias": "span",
                            "args": null,
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v3/*:: as any*/),
                              (v6/*:: as any*/),
                              (v7/*:: as any*/),
                              (v8/*:: as any*/),
                              (v9/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Trace",
                                "kind": "LinkedField",
                                "name": "trace",
                                "plural": false,
                                "selections": [
                                  (v10/*:: as any*/)
                                ],
                                "storageKey": null
                              },
                              {
                                "args": null,
                                "kind": "FragmentSpread",
                                "name": "TraceTurnContent_rootSpan"
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "spans(first:1,orphanSpanAsRootSpan:true,rootSpansOnly:true)"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SessionDetailsTracesViewSelectedTraceQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v2/*:: as any*/),
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
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
                            "alias": "span",
                            "args": null,
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v3/*:: as any*/),
                              (v6/*:: as any*/),
                              (v7/*:: as any*/),
                              (v8/*:: as any*/),
                              (v9/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Trace",
                                "kind": "LinkedField",
                                "name": "trace",
                                "plural": false,
                                "selections": [
                                  (v10/*:: as any*/),
                                  (v3/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "Project",
                                    "kind": "LinkedField",
                                    "name": "project",
                                    "plural": false,
                                    "selections": [
                                      (v3/*:: as any*/),
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
                                                  (v11/*:: as any*/),
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v12/*:: as any*/)
                                                    ],
                                                    "type": "AnnotationConfigBase",
                                                    "abstractKey": "__isAnnotationConfigBase"
                                                  },
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v3/*:: as any*/),
                                                      (v13/*:: as any*/),
                                                      (v14/*:: as any*/),
                                                      (v17/*:: as any*/)
                                                    ],
                                                    "type": "CategoricalAnnotationConfig",
                                                    "abstractKey": null
                                                  },
                                                  (v18/*:: as any*/)
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
                                      (v3/*:: as any*/),
                                      (v13/*:: as any*/),
                                      (v15/*:: as any*/),
                                      (v16/*:: as any*/),
                                      (v19/*:: as any*/),
                                      (v20/*:: as any*/),
                                      (v21/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "User",
                                        "kind": "LinkedField",
                                        "name": "user",
                                        "plural": false,
                                        "selections": [
                                          (v22/*:: as any*/),
                                          (v23/*:: as any*/),
                                          (v3/*:: as any*/)
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
                                    "selections": (v24/*:: as any*/),
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
                                      (v3/*:: as any*/),
                                      (v15/*:: as any*/),
                                      (v25/*:: as any*/)
                                    ],
                                    "storageKey": "traceAnnotations(filter:{\"include\":{\"names\":[\"user_feedback\"]}})"
                                  }
                                ],
                                "storageKey": null
                              },
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
                                  (v3/*:: as any*/),
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
                                              (v11/*:: as any*/),
                                              {
                                                "kind": "InlineFragment",
                                                "selections": [
                                                  (v13/*:: as any*/),
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "kind": "ScalarField",
                                                    "name": "description",
                                                    "storageKey": null
                                                  },
                                                  (v12/*:: as any*/),
                                                  (v18/*:: as any*/),
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v14/*:: as any*/),
                                                      (v17/*:: as any*/)
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
                                                      (v14/*:: as any*/)
                                                    ],
                                                    "type": "ContinuousAnnotationConfig",
                                                    "abstractKey": null
                                                  },
                                                  {
                                                    "kind": "InlineFragment",
                                                    "selections": [
                                                      (v14/*:: as any*/),
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
                                              (v18/*:: as any*/)
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
                                "selections": (v26/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanIOValue",
                                "kind": "LinkedField",
                                "name": "output",
                                "plural": false,
                                "selections": (v26/*:: as any*/),
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
                                "concreteType": "SpanAnnotation",
                                "kind": "LinkedField",
                                "name": "spanAnnotations",
                                "plural": true,
                                "selections": [
                                  (v3/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v13/*:: as any*/),
                                      (v15/*:: as any*/),
                                      (v16/*:: as any*/),
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
                                      (v19/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "source",
                                        "storageKey": null
                                      },
                                      (v25/*:: as any*/),
                                      (v20/*:: as any*/),
                                      (v21/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "User",
                                        "kind": "LinkedField",
                                        "name": "user",
                                        "plural": false,
                                        "selections": [
                                          (v3/*:: as any*/),
                                          (v22/*:: as any*/),
                                          (v23/*:: as any*/)
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
                                "selections": (v24/*:: as any*/),
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "spans(first:1,orphanSpanAsRootSpan:true,rootSpansOnly:true)"
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
    ]
  },
  "params": {
    "cacheID": "208f83977476f8af0678d4f74e8cb5a1",
    "id": null,
    "metadata": {},
    "name": "SessionDetailsTracesViewSelectedTraceQuery",
    "operationKind": "query",
    "text": "query SessionDetailsTracesViewSelectedTraceQuery(\n  $projectId: ID!\n  $traceId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      trace(traceId: $traceId) {\n        id\n        traceId\n        rootSpans: spans(first: 1, rootSpansOnly: true, orphanSpanAsRootSpan: true) {\n          edges {\n            span: node {\n              id\n              spanId\n              latencyMs\n              startTime\n              cumulativeTokenCountTotal\n              trace {\n                costSummary {\n                  total {\n                    cost\n                  }\n                }\n                id\n              }\n              ...TraceTurnContent_rootSpan\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  id\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ...ConnectedDetailPanelAnnotationBarConfigFields\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    ...ConnectedDetailPanelAnnotationBarAnnotationFields\n    id\n  }\n  spanAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment ConnectedDetailPanelAnnotationBarAnnotationFields on Annotation {\n  __isAnnotation: __typename\n  ... on Node {\n    __isNode: __typename\n    id\n  }\n  name\n  label\n  score\n  explanation\n  metadata\n  annotatorKind\n  source\n  identifier\n  createdAt\n  updatedAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n}\n\nfragment ConnectedDetailPanelAnnotationBarConfigFields on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  __typename\n  ... on Node {\n    __isNode: __typename\n    id\n  }\n  name\n  description\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    lowerBound\n    upperBound\n    optimizationDirection\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n  }\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  traceAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  traceAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment TraceFeedbackActionToolbar_trace on Trace {\n  id\n  viewerUserFeedbackAnnotations: traceAnnotations(filter: {include: {names: [\"user_feedback\"]}}) {\n    id\n    label\n    identifier\n  }\n}\n\nfragment TraceTurnContent_rootSpan on Span {\n  id\n  attributes\n  project {\n    id\n  }\n  input {\n    value\n  }\n  output {\n    value\n  }\n  cumulativeTokenCountTotal\n  latencyMs\n  startTime\n  endTime\n  trace {\n    id\n    costSummary {\n      total {\n        cost\n      }\n    }\n    ...TraceAnnotationSummaryGroup\n    ...TraceFeedbackActionToolbar_trace\n  }\n  ...AnnotationSummaryGroup\n}\n"
  }
};
})();

(node as any).hash = "2816ae5eb4bc35d8a4ae05a1c4fa94da";

export default node;
