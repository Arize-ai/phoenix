/**
 * @generated SignedSource<<69b2e49f4cd540e4bd7d2ee15f8c5d1a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MimeType = "json" | "text";
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "prompt" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
export type sessionPageContextSelectedTraceQuery$variables = {
  projectId: string;
  traceId: string;
};
export type sessionPageContextSelectedTraceQuery$data = {
  readonly node: {
    readonly __typename: "Project";
    readonly id: string;
    readonly name: string;
    readonly trace: {
      readonly id: string;
      readonly latencyMs: number | null;
      readonly projectSessionId: string | null;
      readonly rootSpan: {
        readonly cumulativeTokenCountTotal: number | null;
        readonly endTime: string | null;
        readonly id: string;
        readonly input: {
          readonly mimeType: MimeType;
          readonly truncatedValue: string;
          readonly value: string;
        } | null;
        readonly latencyMs: number | null;
        readonly name: string;
        readonly output: {
          readonly mimeType: MimeType;
          readonly truncatedValue: string;
          readonly value: string;
        } | null;
        readonly spanId: string;
        readonly spanKind: SpanKind;
        readonly startTime: string;
        readonly statusCode: SpanStatusCode;
      } | null;
      readonly spans: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly endTime: string | null;
            readonly id: string;
            readonly latencyMs: number | null;
            readonly name: string;
            readonly parentId: string | null;
            readonly spanId: string;
            readonly spanKind: SpanKind;
            readonly startTime: string;
            readonly statusCode: SpanStatusCode;
          };
        }>;
      };
      readonly traceId: string;
    } | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type sessionPageContextSelectedTraceQuery = {
  response: sessionPageContextSelectedTraceQuery$data;
  variables: sessionPageContextSelectedTraceQuery$variables;
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
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
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
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
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
  "name": "spanKind",
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
  "name": "endTime",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusCode",
  "storageKey": null
},
v11 = [
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
v12 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "traceId",
      "variableName": "traceId"
    }
  ],
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    (v3/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceId",
      "storageKey": null
    },
    (v5/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "projectSessionId",
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
        (v3/*: any*/),
        (v6/*: any*/),
        (v4/*: any*/),
        (v7/*: any*/),
        (v8/*: any*/),
        (v9/*: any*/),
        (v5/*: any*/),
        (v10/*: any*/),
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
          "concreteType": "SpanIOValue",
          "kind": "LinkedField",
          "name": "input",
          "plural": false,
          "selections": (v11/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanIOValue",
          "kind": "LinkedField",
          "name": "output",
          "plural": false,
          "selections": (v11/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 20
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
              "alias": null,
              "args": null,
              "concreteType": "Span",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v3/*: any*/),
                (v6/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "parentId",
                  "storageKey": null
                },
                (v4/*: any*/),
                (v7/*: any*/),
                (v8/*: any*/),
                (v9/*: any*/),
                (v5/*: any*/),
                (v10/*: any*/)
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "spans(first:20)"
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "sessionPageContextSelectedTraceQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v12/*: any*/)
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "sessionPageContextSelectedTraceQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v12/*: any*/)
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
    "cacheID": "5fda35fbf0d5ae57f0ccb728f521861e",
    "id": null,
    "metadata": {},
    "name": "sessionPageContextSelectedTraceQuery",
    "operationKind": "query",
    "text": "query sessionPageContextSelectedTraceQuery(\n  $projectId: ID!\n  $traceId: ID!\n) {\n  node(id: $projectId) {\n    __typename\n    ... on Project {\n      id\n      name\n      trace(traceId: $traceId) {\n        id\n        traceId\n        latencyMs\n        projectSessionId\n        rootSpan {\n          id\n          spanId\n          name\n          spanKind\n          startTime\n          endTime\n          latencyMs\n          statusCode\n          cumulativeTokenCountTotal\n          input {\n            value\n            truncatedValue\n            mimeType\n          }\n          output {\n            value\n            truncatedValue\n            mimeType\n          }\n        }\n        spans(first: 20) {\n          edges {\n            node {\n              id\n              spanId\n              parentId\n              name\n              spanKind\n              startTime\n              endTime\n              latencyMs\n              statusCode\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "065a4c0056731e12dd575865f5cc7c00";

export default node;
