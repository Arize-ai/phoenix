/**
 * @generated SignedSource<<8888d2a5cdb51e3e2f2f3e7aec19fe1f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceDetailsQuery$variables = {
  id: string;
  traceId: string;
};
export type TraceDetailsQuery$data = {
  readonly project: {
    readonly trace?: {
      readonly id: string;
      readonly rootSpans: {
        readonly edges: ReadonlyArray<{
          readonly span: {
            readonly id: string;
            readonly parentId: string | null;
            readonly spanId: string;
          };
        }>;
      };
      readonly session: {
        readonly id: string;
        readonly sessionId: string;
      } | null;
      readonly traceId: string;
      readonly " $fragmentSpreads": FragmentRefs<"ConnectedTraceTree">;
    } | null;
  };
};
export type TraceDetailsQuery = {
  response: TraceDetailsQuery$data;
  variables: TraceDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "traceId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "traceId",
    "variableName": "traceId"
  }
],
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
  "name": "traceId",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "ProjectSession",
  "kind": "LinkedField",
  "name": "session",
  "plural": false,
  "selections": [
    (v4/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sessionId",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v9 = {
  "alias": "rootSpans",
  "args": [
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
            (v4/*:: as any*/),
            (v7/*:: as any*/),
            (v8/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "spans(first:1,orphanSpanAsRootSpan:true,rootSpansOnly:true)"
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v11 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 1000
  }
],
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceDetailsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*:: as any*/),
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
                "args": (v3/*:: as any*/),
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ConnectedTraceTree"
                  },
                  (v9/*:: as any*/)
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
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TraceDetailsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "numSpans",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v11/*:: as any*/),
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
                              (v4/*:: as any*/),
                              (v7/*:: as any*/),
                              (v12/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "spanKind",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "statusCode",
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
                              (v8/*:: as any*/),
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
                                "name": "tokenCountTotal",
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
                                    "kind": "ScalarField",
                                    "name": "labels",
                                    "storageKey": null
                                  },
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
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "label",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  (v12/*:: as any*/),
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
                                    "name": "meanScore",
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
                              (v10/*:: as any*/),
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
                    "storageKey": "spans(first:1000)"
                  },
                  {
                    "alias": null,
                    "args": (v11/*:: as any*/),
                    "filters": null,
                    "handle": "connection",
                    "key": "ConnectedTraceTree_spans",
                    "kind": "LinkedHandle",
                    "name": "spans"
                  },
                  (v9/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "1f8fed482abe84a4c2e7b321fa2c2aa2",
    "id": null,
    "metadata": {},
    "name": "TraceDetailsQuery",
    "operationKind": "query",
    "text": "query TraceDetailsQuery(\n  $traceId: ID!\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      trace(traceId: $traceId) {\n        id\n        traceId\n        session {\n          id\n          sessionId\n        }\n        ...ConnectedTraceTree\n        rootSpans: spans(first: 1, rootSpansOnly: true, orphanSpanAsRootSpan: true) {\n          edges {\n            span: node {\n              id\n              spanId\n              parentId\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ConnectedTraceTree on Trace {\n  numSpans\n  spans(first: 1000) {\n    edges {\n      span: node {\n        id\n        spanId\n        name\n        spanKind\n        statusCode\n        startTime\n        endTime\n        parentId\n        latencyMs\n        tokenCountTotal\n        spanAnnotationSummaries {\n          labels\n          count\n          labelCount\n          labelFractions {\n            fraction\n            label\n          }\n          name\n          scoreCount\n          meanScore\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "a737d8eec2acdc0c4a45b1c9baaf4e6b";

export default node;
