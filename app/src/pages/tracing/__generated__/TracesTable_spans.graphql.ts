/**
 * @generated SignedSource<<6d945d3fb479a1b3195e7248072ce76b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
export type SpanKind = "agent" | "chain" | "embedding" | "llm" | "reranking" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
import { FragmentRefs } from "relay-runtime";
export type TracesTable_spans$data = {
  readonly rootSpans: {
    readonly edges: ReadonlyArray<{
      readonly rootSpan: {
        readonly context: {
          readonly spanId: string;
          readonly traceId: string;
        };
        readonly cumulativeTokenCountCompletion: number | null;
        readonly cumulativeTokenCountPrompt: number | null;
        readonly cumulativeTokenCountTotal: number | null;
        readonly descendants: ReadonlyArray<{
          readonly context: {
            readonly spanId: string;
            readonly traceId: string;
          };
          readonly cumulativeTokenCountCompletion: number | null;
          readonly cumulativeTokenCountPrompt: number | null;
          readonly cumulativeTokenCountTotal: number | null;
          readonly input: {
            readonly value: string;
          } | null;
          readonly latencyMs: number | null;
          readonly name: string;
          readonly output: {
            readonly value: string;
          } | null;
          readonly parentId: string | null;
          readonly spanKind: SpanKind;
          readonly startTime: string;
          readonly statusCode: SpanStatusCode;
        }>;
        readonly input: {
          readonly value: string;
        } | null;
        readonly latencyMs: number | null;
        readonly name: string;
        readonly output: {
          readonly value: string;
        } | null;
        readonly parentId: string | null;
        readonly spanKind: SpanKind;
        readonly startTime: string;
        readonly statusCode: SpanStatusCode;
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
  "name": "statusCode",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
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
  "name": "parentId",
  "storageKey": null
},
v7 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": null
},
v10 = {
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
                  "name": "cumulativeTokenCountPrompt",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "cumulativeTokenCountCompletion",
                  "storageKey": null
                },
                (v6/*: any*/),
                (v8/*: any*/),
                (v9/*: any*/),
                (v10/*: any*/),
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
                    (v5/*: any*/),
                    (v6/*: any*/),
                    {
                      "alias": "cumulativeTokenCountTotal",
                      "args": null,
                      "kind": "ScalarField",
                      "name": "tokenCountTotal",
                      "storageKey": null
                    },
                    {
                      "alias": "cumulativeTokenCountPrompt",
                      "args": null,
                      "kind": "ScalarField",
                      "name": "tokenCountPrompt",
                      "storageKey": null
                    },
                    {
                      "alias": "cumulativeTokenCountCompletion",
                      "args": null,
                      "kind": "ScalarField",
                      "name": "tokenCountCompletion",
                      "storageKey": null
                    },
                    (v8/*: any*/),
                    (v9/*: any*/),
                    (v10/*: any*/)
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

(node as any).hash = "0921c61cd7142454d7d05e273a49912e";

export default node;
