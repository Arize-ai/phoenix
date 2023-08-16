/**
 * @generated SignedSource<<af230bf9aeaf689403851337aeedf165>>
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
        readonly context: {
          readonly spanId: string;
        };
        readonly latencyMs: number;
        readonly name: string;
        readonly parentId: string | null;
        readonly spanKind: SpanKind;
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
          "dir": "desc"
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
                "name": "parentId",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "latencyMs",
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
    "cacheID": "ce552fd95c010d0b53a5facabd2f6d93",
    "id": null,
    "metadata": {},
    "name": "TracePageQuery",
    "operationKind": "query",
    "text": "query TracePageQuery(\n  $traceId: ID!\n) {\n  spans(traceIds: [$traceId], sort: {col: startTime, dir: desc}) {\n    edges {\n      span: node {\n        context {\n          spanId\n        }\n        name\n        spanKind\n        parentId\n        latencyMs\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4704e6754a95c3bafda8082364b4a4e8";

export default node;
