/**
 * @generated SignedSource<<e58f7ad587242028515b34939b503659>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type MimeType = "json" | "text";
export type SpanKind = "chain" | "embedding" | "llm" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
export type TracePageQuery$variables = {
  traceId: string;
};
export type TracePageQuery$data = {
  readonly spans: {
    readonly edges: ReadonlyArray<{
      readonly span: {
        readonly attributes: string;
        readonly context: {
          readonly spanId: string;
        };
        readonly events: ReadonlyArray<{
          readonly message: string;
          readonly name: string;
          readonly timestamp: string;
        }>;
        readonly input: {
          readonly mimeType: MimeType;
          readonly value: string | null;
        };
        readonly latencyMs: number;
        readonly name: string;
        readonly output: {
          readonly mimeType: MimeType;
          readonly value: string | null;
        };
        readonly parentId: string | null;
        readonly spanKind: SpanKind;
        readonly startTime: string;
        readonly statusCode: SpanStatusCode;
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = [
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
v3 = [
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
              (v1/*: any*/),
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
                "concreteType": "SpanIOValue",
                "kind": "LinkedField",
                "name": "input",
                "plural": false,
                "selections": (v2/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "SpanIOValue",
                "kind": "LinkedField",
                "name": "output",
                "plural": false,
                "selections": (v2/*: any*/),
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
                "concreteType": "SpanEvent",
                "kind": "LinkedField",
                "name": "events",
                "plural": true,
                "selections": [
                  (v1/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "message",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "timestamp",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TracePageQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TracePageQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "c2af36a5858b92c2d5e25794fc8062c2",
    "id": null,
    "metadata": {},
    "name": "TracePageQuery",
    "operationKind": "query",
    "text": "query TracePageQuery(\n  $traceId: ID!\n) {\n  spans(traceIds: [$traceId], sort: {col: startTime, dir: asc}) {\n    edges {\n      span: node {\n        context {\n          spanId\n        }\n        name\n        spanKind\n        statusCode\n        startTime\n        parentId\n        latencyMs\n        input {\n          value\n          mimeType\n        }\n        output {\n          value\n          mimeType\n        }\n        attributes\n        events {\n          name\n          message\n          timestamp\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "714402df3fc9eaf49a3c20eb9d5e9988";

export default node;
