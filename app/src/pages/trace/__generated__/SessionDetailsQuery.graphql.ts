/**
 * @generated SignedSource<<2d15125d81ec2184f873133220d22012>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type MimeType = "json" | "text";
export type SessionDetailsQuery$variables = {
  id: string;
};
export type SessionDetailsQuery$data = {
  readonly session: {
    readonly latencyP50?: number | null;
    readonly numTraces?: number;
    readonly sessionId?: string;
    readonly tokenUsage?: {
      readonly completion: number;
      readonly prompt: number;
      readonly total: number;
    };
    readonly traces?: {
      readonly edges: ReadonlyArray<{
        readonly trace: {
          readonly id: string;
          readonly rootSpan: {
            readonly attributes: string;
            readonly cumulativeTokenCountCompletion: number | null;
            readonly cumulativeTokenCountPrompt: number | null;
            readonly cumulativeTokenCountTotal: number | null;
            readonly id: string;
            readonly input: {
              readonly mimeType: MimeType;
              readonly value: string;
            } | null;
            readonly latencyMs: number | null;
            readonly output: {
              readonly mimeType: MimeType;
              readonly value: string;
            } | null;
            readonly project: {
              readonly id: string;
            };
            readonly spanId: string;
            readonly startTime: string;
            readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
          } | null;
          readonly traceId: string;
        };
      }>;
    };
  };
};
export type SessionDetailsQuery = {
  response: SessionDetailsQuery$data;
  variables: SessionDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numTraces",
  "storageKey": null
},
v3 = {
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "completion",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "prompt",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v5 = {
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
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "attributes",
  "storageKey": null
},
v9 = [
  (v6/*: any*/)
],
v10 = [
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
],
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v10/*: any*/),
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v10/*: any*/),
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountTotal",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountCompletion",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountPrompt",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionDetailsQuery",
    "selections": [
      {
        "alias": "session",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
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
                          (v6/*: any*/),
                          (v7/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "rootSpan",
                            "plural": false,
                            "selections": [
                              (v6/*: any*/),
                              (v8/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Project",
                                "kind": "LinkedField",
                                "name": "project",
                                "plural": false,
                                "selections": (v9/*: any*/),
                                "storageKey": null
                              },
                              (v11/*: any*/),
                              (v12/*: any*/),
                              (v13/*: any*/),
                              (v14/*: any*/),
                              (v15/*: any*/),
                              (v16/*: any*/),
                              (v17/*: any*/),
                              (v18/*: any*/),
                              {
                                "args": null,
                                "kind": "FragmentSpread",
                                "name": "AnnotationSummaryGroup"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SessionDetailsQuery",
    "selections": [
      {
        "alias": "session",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v19/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
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
                          (v6/*: any*/),
                          (v7/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "rootSpan",
                            "plural": false,
                            "selections": [
                              (v6/*: any*/),
                              (v8/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Project",
                                "kind": "LinkedField",
                                "name": "project",
                                "plural": false,
                                "selections": [
                                  (v6/*: any*/),
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
                                              (v19/*: any*/),
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
                                                  (v6/*: any*/),
                                                  (v20/*: any*/),
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
                                                      (v21/*: any*/),
                                                      (v22/*: any*/)
                                                    ],
                                                    "storageKey": null
                                                  }
                                                ],
                                                "type": "CategoricalAnnotationConfig",
                                                "abstractKey": null
                                              },
                                              {
                                                "kind": "InlineFragment",
                                                "selections": (v9/*: any*/),
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
                              (v11/*: any*/),
                              (v12/*: any*/),
                              (v13/*: any*/),
                              (v14/*: any*/),
                              (v15/*: any*/),
                              (v16/*: any*/),
                              (v17/*: any*/),
                              (v18/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanAnnotation",
                                "kind": "LinkedField",
                                "name": "spanAnnotations",
                                "plural": true,
                                "selections": [
                                  (v6/*: any*/),
                                  (v20/*: any*/),
                                  (v21/*: any*/),
                                  (v22/*: any*/),
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
                                      (v6/*: any*/)
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
                                      (v21/*: any*/)
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
                                  (v20/*: any*/)
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
            "type": "ProjectSession",
            "abstractKey": null
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "707bef8f623ad6a62be90384f13ce8ce",
    "id": null,
    "metadata": {},
    "name": "SessionDetailsQuery",
    "operationKind": "query",
    "text": "query SessionDetailsQuery(\n  $id: ID!\n) {\n  session: node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      numTraces\n      tokenUsage {\n        total\n        completion\n        prompt\n      }\n      sessionId\n      latencyP50: traceLatencyMsQuantile(probability: 0.5)\n      traces {\n        edges {\n          trace: node {\n            id\n            traceId\n            rootSpan {\n              id\n              attributes\n              project {\n                id\n              }\n              input {\n                value\n                mimeType\n              }\n              output {\n                value\n                mimeType\n              }\n              cumulativeTokenCountTotal\n              cumulativeTokenCountCompletion\n              cumulativeTokenCountPrompt\n              latencyMs\n              startTime\n              spanId\n              ...AnnotationSummaryGroup\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  spanAnnotationSummaries {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "fd51c94d3b69015034ae67ae195aa15d";

export default node;
