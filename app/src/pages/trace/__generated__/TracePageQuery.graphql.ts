/**
 * @generated SignedSource<<39547851f6841cb3ffcc649bffcd7224>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type SpanKind = "chain" | "embedding" | "llm" | "retriever" | "tool" | "unknown";
export type TracePageQuery$variables = {
  traceId: string;
};
export type TracePageQuery$data = {
  readonly spans: {
    readonly edges: ReadonlyArray<{
      readonly span: {
        readonly attributes: any;
        readonly context: {
          readonly spanId: string;
        };
        readonly latencyMs: number;
        readonly name: string;
        readonly parentId: string | null;
        readonly spanKind: SpanKind;
        readonly startTime: string;
      };
    }>;
  };
};
export type TracePageQuery = {
  response: TracePageQuery$data;
  variables: TracePageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "sort",
        "value": {
          "col": "startTime",
          "dir": "asc"
        }
      },
      {
        "items": [
          {
            "kind": "Variable",
            "name": "traceIds.0",
            "variableName": "traceId"
          }
        ],
        "kind": "ListValue",
        "name": "traceIds"
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
                    "name": "spanId",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
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
                "name": "spanKind",
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
                "name": "parentId",
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
                "name": "attributes",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TracePageQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TracePageQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "62a7ce7d319480405a0522d8fce96b4f",
    "id": null,
    "metadata": {},
    "name": "TracePageQuery",
    "operationKind": "query",
    "text": "query TracePageQuery(\n  $traceId: ID!\n) {\n  spans(traceIds: [$traceId], sort: {col: startTime, dir: asc}) {\n    edges {\n      span: node {\n        context {\n          spanId\n        }\n        name\n        spanKind\n        startTime\n        parentId\n        latencyMs\n        attributes\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f195c47905dcfa844a4332dd49680e04";

export default node;
