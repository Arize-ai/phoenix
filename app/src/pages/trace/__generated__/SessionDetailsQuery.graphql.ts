/**
 * @generated SignedSource<<73becc73e502fdbabdef2662fcad6b4e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
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
            readonly spanAnnotationSummaries: ReadonlyArray<{
              readonly labelFractions: ReadonlyArray<{
                readonly fraction: number;
                readonly label: string;
              }>;
              readonly meanScore: number | null;
              readonly name: string;
            }>;
            readonly spanAnnotations: ReadonlyArray<{
              readonly annotatorKind: AnnotatorKind;
              readonly createdAt: string;
              readonly explanation: string | null;
              readonly id: string;
              readonly label: string | null;
              readonly name: string;
              readonly score: number | null;
            }>;
            readonly spanId: string;
            readonly startTime: string;
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
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mimeType",
    "storageKey": null
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v6 = {
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
                (v2/*: any*/),
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
                        (v2/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "createdAt",
                          "storageKey": null
                        },
                        (v4/*: any*/),
                        (v5/*: any*/),
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
                      "concreteType": "AnnotationSummary",
                      "kind": "LinkedField",
                      "name": "spanAnnotationSummaries",
                      "plural": true,
                      "selections": [
                        (v4/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "LabelFraction",
                          "kind": "LinkedField",
                          "name": "labelFractions",
                          "plural": true,
                          "selections": [
                            (v5/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "fraction",
                              "storageKey": null
                            }
                          ],
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
          (v6/*: any*/)
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
          (v6/*: any*/),
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
    "cacheID": "e67b24562757b280601c697d6235ddda",
    "id": null,
    "metadata": {},
    "name": "SessionDetailsQuery",
    "operationKind": "query",
    "text": "query SessionDetailsQuery(\n  $id: GlobalID!\n) {\n  session: node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      numTraces\n      tokenUsage {\n        total\n        completion\n        prompt\n      }\n      sessionId\n      latencyP50: traceLatencyMsQuantile(probability: 0.5)\n      traces {\n        edges {\n          trace: node {\n            id\n            traceId\n            rootSpan {\n              id\n              attributes\n              project {\n                id\n              }\n              input {\n                value\n                mimeType\n              }\n              output {\n                value\n                mimeType\n              }\n              cumulativeTokenCountTotal\n              cumulativeTokenCountCompletion\n              cumulativeTokenCountPrompt\n              latencyMs\n              startTime\n              spanAnnotations {\n                id\n                createdAt\n                name\n                label\n                score\n                explanation\n                annotatorKind\n              }\n              spanAnnotationSummaries {\n                name\n                labelFractions {\n                  label\n                  fraction\n                }\n                meanScore\n              }\n              spanId\n            }\n          }\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5a2b13d0a4b2ef361e0442abe302cc4a";

export default node;
