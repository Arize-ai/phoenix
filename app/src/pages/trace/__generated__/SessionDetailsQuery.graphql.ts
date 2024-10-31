/**
 * @generated SignedSource<<28282f75d4f26db4127e9335922e5241>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
export type SessionDetailsQuery$variables = {
  id: string;
};
export type SessionDetailsQuery$data = {
  readonly session: {
    readonly durationS?: number;
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
          readonly rootSpan: {
            readonly attributes: string;
            readonly context: {
              readonly spanId: string;
              readonly traceId: string;
            };
            readonly cumulativeTokenCountCompletion: number | null;
            readonly cumulativeTokenCountPrompt: number | null;
            readonly cumulativeTokenCountTotal: number | null;
            readonly id: string;
            readonly input: {
              readonly value: string;
            } | null;
            readonly latencyMs: number | null;
            readonly output: {
              readonly value: string;
            } | null;
            readonly project: {
              readonly id: string;
            };
            readonly spanAnnotations: ReadonlyArray<{
              readonly annotatorKind: AnnotatorKind;
              readonly explanation: string | null;
              readonly label: string | null;
              readonly name: string;
              readonly score: number | null;
            }>;
            readonly startTime: string;
          } | null;
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
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
],
v4 = {
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
      "args": null,
      "kind": "ScalarField",
      "name": "durationS",
      "storageKey": null
    },
    {
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
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sessionId",
      "storageKey": null
    },
    {
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
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Span",
                  "kind": "LinkedField",
                  "name": "rootSpan",
                  "plural": false,
                  "selections": [
                    (v2/*: any*/),
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
                        (v2/*: any*/)
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
                      "selections": (v3/*: any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanIOValue",
                      "kind": "LinkedField",
                      "name": "output",
                      "plural": false,
                      "selections": (v3/*: any*/),
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
                      "name": "cumulativeTokenCountCompletion",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "cumulativeTokenCountPrompt",
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
                      "concreteType": "SpanAnnotation",
                      "kind": "LinkedField",
                      "name": "spanAnnotations",
                      "plural": true,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "name",
                          "storageKey": null
                        },
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
                          "name": "explanation",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "annotatorKind",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanContext",
                      "kind": "LinkedField",
                      "name": "context",
                      "plural": false,
                      "selections": [
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
                          "name": "spanId",
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
  "type": "ProjectSession",
  "abstractKey": null
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
          (v4/*: any*/)
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v4/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e55d7e6a04298907a625a98adc9a7fb0",
    "id": null,
    "metadata": {},
    "name": "SessionDetailsQuery",
    "operationKind": "query",
    "text": "query SessionDetailsQuery(\n  $id: GlobalID!\n) {\n  session: node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      numTraces\n      durationS\n      tokenUsage {\n        total\n        completion\n        prompt\n      }\n      sessionId\n      latencyP50: traceLatencyMsQuantile(probability: 0.5)\n      traces {\n        edges {\n          trace: node {\n            rootSpan {\n              id\n              attributes\n              project {\n                id\n              }\n              input {\n                value\n              }\n              output {\n                value\n              }\n              cumulativeTokenCountTotal\n              cumulativeTokenCountCompletion\n              cumulativeTokenCountPrompt\n              latencyMs\n              startTime\n              spanAnnotations {\n                name\n                label\n                score\n                explanation\n                annotatorKind\n              }\n              context {\n                traceId\n                spanId\n              }\n            }\n          }\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "97585857fc11e3e32278d27c935f2017";

export default node;
