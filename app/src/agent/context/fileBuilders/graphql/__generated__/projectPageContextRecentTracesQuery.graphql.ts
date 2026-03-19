/**
 * @generated SignedSource<<54005f3760fba49e52c76e1e616e523a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type projectPageContextRecentTracesQuery$variables = {
  id: string;
  timeRange?: TimeRange | null;
};
export type projectPageContextRecentTracesQuery$data = {
  readonly node: {
    readonly __typename: "Project";
    readonly id: string;
    readonly name: string;
    readonly spans: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly endTime: string | null;
          readonly id: string;
          readonly latencyMs: number | null;
          readonly name: string;
          readonly spanId: string;
          readonly startTime: string;
          readonly statusCode: SpanStatusCode;
          readonly trace: {
            readonly id: string;
            readonly traceId: string;
          };
        };
      }>;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type projectPageContextRecentTracesQuery = {
  response: projectPageContextRecentTracesQuery$data;
  variables: projectPageContextRecentTracesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
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
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 5
    },
    {
      "kind": "Literal",
      "name": "rootSpansOnly",
      "value": true
    },
    {
      "kind": "Literal",
      "name": "sort",
      "value": {
        "col": "startTime",
        "dir": "desc"
      }
    },
    {
      "kind": "Variable",
      "name": "timeRange",
      "variableName": "timeRange"
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
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "spanId",
              "storageKey": null
            },
            (v4/*: any*/),
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
              "name": "statusCode",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectPageContextRecentTracesQuery",
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
              (v5/*: any*/)
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
    "name": "projectPageContextRecentTracesQuery",
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
              (v5/*: any*/)
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
    "cacheID": "3b6838207ca15cf81b7ddb1ff6b2b2be",
    "id": null,
    "metadata": {},
    "name": "projectPageContextRecentTracesQuery",
    "operationKind": "query",
    "text": "query projectPageContextRecentTracesQuery(\n  $id: ID!\n  $timeRange: TimeRange\n) {\n  node(id: $id) {\n    __typename\n    ... on Project {\n      id\n      name\n      spans(first: 5, rootSpansOnly: true, sort: {col: startTime, dir: desc}, timeRange: $timeRange) {\n        edges {\n          node {\n            id\n            spanId\n            name\n            startTime\n            endTime\n            latencyMs\n            statusCode\n            trace {\n              id\n              traceId\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "16672e279c7832c59958b949a81a94ba";

export default node;
