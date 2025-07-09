/**
 * @generated SignedSource<<c6705b512ab5c46a34e4eb37456f41f4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionDetailsQuery$variables = {
  first?: number | null;
  id: string;
};
export type SessionDetailsQuery$data = {
  readonly session: {
    readonly costSummary?: {
      readonly completion: {
        readonly cost: number | null;
        readonly costPerToken: number | null;
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly cost: number | null;
        readonly costPerToken: number | null;
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly costPerToken: number | null;
        readonly tokens: number | null;
      };
    };
    readonly latencyP50?: number | null;
    readonly numTraces?: number;
    readonly sessionId?: string;
    readonly tokenUsage?: {
      readonly total: number;
    };
    readonly " $fragmentSpreads": FragmentRefs<"SessionDetailsTraceList_traces">;
  };
};
export type SessionDetailsQuery = {
  response: SessionDetailsQuery$data;
  variables: SessionDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numTraces",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "TokenUsage",
  "kind": "LinkedField",
  "name": "tokenUsage",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "total",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v6 = [
  (v5/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokens",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "costPerToken",
    "storageKey": null
  }
],
v7 = {
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
      "selections": (v6/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v6/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v6/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v9 = {
  "alias": "latencyP50",
  "args": [
    {
      "kind": "Literal",
      "name": "probability",
      "value": 0.5
    }
  ],
  "kind": "ScalarField",
  "name": "traceLatencyMsQuantile",
  "storageKey": "traceLatencyMsQuantile(probability:0.5)"
},
v10 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
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
  "name": "id",
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
  "name": "label",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v16 = [
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
    "name": "mimeType",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionDetailsQuery",
    "selections": [
      {
        "alias": "session",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "args": (v10/*: any*/),
                "kind": "FragmentSpread",
                "name": "SessionDetailsTraceList_traces"
              }
            ],
            "type": "ProjectSession",
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
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "SessionDetailsQuery",
    "selections": [
      {
        "alias": "session",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*: any*/),
          (v12/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": (v10/*: any*/),
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
                          (v12/*: any*/),
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
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "rootSpan",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Trace",
                                "kind": "LinkedField",
                                "name": "trace",
                                "plural": false,
                                "selections": [
                                  (v12/*: any*/),
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
                                          (v5/*: any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v12/*: any*/),
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
                                  (v12/*: any*/),
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
                                              (v11/*: any*/),
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
                                                  (v12/*: any*/),
                                                  (v13/*: any*/),
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
                                                      (v14/*: any*/),
                                                      (v15/*: any*/)
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
                                                  (v12/*: any*/)
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
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanIOValue",
                                "kind": "LinkedField",
                                "name": "input",
                                "plural": false,
                                "selections": (v16/*: any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanIOValue",
                                "kind": "LinkedField",
                                "name": "output",
                                "plural": false,
                                "selections": (v16/*: any*/),
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
                                "name": "spanId",
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
                                  (v12/*: any*/),
                                  (v13/*: any*/),
                                  (v14/*: any*/),
                                  (v15/*: any*/),
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
                                      (v12/*: any*/)
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
                                      (v14/*: any*/)
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
                                  (v13/*: any*/)
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
                        "concreteType": "Trace",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v11/*: any*/),
                          (v12/*: any*/)
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
                "args": (v10/*: any*/),
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
    "cacheID": "84c30e348a46bf4a66c53c5d949c4343",
    "id": null,
    "metadata": {},
    "name": "SessionDetailsQuery",
    "operationKind": "query",
    "text": "query SessionDetailsQuery(\n  $id: ID!\n  $first: Int\n) {\n  session: node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      numTraces\n      tokenUsage {\n        total\n      }\n      costSummary {\n        total {\n          cost\n          tokens\n          costPerToken\n        }\n        prompt {\n          cost\n          tokens\n          costPerToken\n        }\n        completion {\n          cost\n          tokens\n          costPerToken\n        }\n      }\n      sessionId\n      latencyP50: traceLatencyMsQuantile(probability: 0.5)\n      ...SessionDetailsTraceList_traces_3ASum4\n    }\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  spanAnnotationSummaries {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment SessionDetailsTraceList_traces_3ASum4 on ProjectSession {\n  traces(first: $first) {\n    edges {\n      trace: node {\n        id\n        traceId\n        rootSpan {\n          trace {\n            id\n            costSummary {\n              total {\n                cost\n              }\n            }\n          }\n          id\n          attributes\n          project {\n            id\n          }\n          input {\n            value\n            mimeType\n          }\n          output {\n            value\n            mimeType\n          }\n          cumulativeTokenCountTotal\n          latencyMs\n          startTime\n          spanId\n          ...AnnotationSummaryGroup\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "c8ad1e535b56f210e7ce26e611df2971";

export default node;
