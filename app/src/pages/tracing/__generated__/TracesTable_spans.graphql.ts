/**
 * @generated SignedSource<<2419b58ccd4ba1a5c5a42f9b2fe94d0a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
export type SpanKind = "chain" | "embedding" | "llm" | "retriever" | "tool" | "unknown";
import { FragmentRefs } from "relay-runtime";
export type TracesTable_spans$data = {
  readonly rootSpans: {
    readonly edges: ReadonlyArray<{
      readonly rootSpan: {
        readonly context: {
          readonly spanId: string;
          readonly traceId: string;
        };
        readonly descendants: ReadonlyArray<{
          readonly context: {
            readonly spanId: string;
            readonly traceId: string;
          };
          readonly latencyMs: number;
          readonly name: string;
          readonly parentId: string | null;
          readonly spanKind: SpanKind;
          readonly startTime: string;
          readonly tokenCountTotal: number | null;
        }>;
        readonly latencyMs: number;
        readonly name: string;
        readonly parentId: string | null;
        readonly spanKind: SpanKind;
        readonly startTime: string;
        readonly tokenCountTotal: number | null;
      };
    }>;
  };
  readonly " $fragmentType": "TracesTable_spans";
};
export type TracesTable_spans$key = {
  readonly " $data"?: TracesTable_spans$data;
  readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
};

const node: ReaderFragment = (function(){
var v0 = [
  "rootSpans"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountTotal",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v7 = {
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceId",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": {
        "col": "startTime",
        "dir": "desc"
      },
      "kind": "LocalArgument",
      "name": "sort"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": require('./TracesTableQuery.graphql')
    }
  },
  "name": "TracesTable_spans",
  "selections": [
    {
      "alias": "rootSpans",
      "args": [
        {
          "kind": "Literal",
          "name": "rootSpansOnly",
          "value": true
        },
        {
          "kind": "Variable",
          "name": "sort",
          "variableName": "sort"
        }
      ],
      "concreteType": "SpanConnection",
      "kind": "LinkedField",
      "name": "__TracesTable_rootSpans_connection",
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
              "alias": "rootSpan",
              "args": null,
              "concreteType": "Span",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*: any*/),
                (v2/*: any*/),
                (v3/*: any*/),
                (v4/*: any*/),
                (v5/*: any*/),
                (v6/*: any*/),
                (v7/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Span",
                  "kind": "LinkedField",
                  "name": "descendants",
                  "plural": true,
                  "selections": [
                    (v1/*: any*/),
                    (v2/*: any*/),
                    (v3/*: any*/),
                    (v4/*: any*/),
                    (v6/*: any*/),
                    (v5/*: any*/),
                    (v7/*: any*/)
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "7f2336053e3ac4191b6aca8f24d5eef3";

export default node;
