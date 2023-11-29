/**
<<<<<<< Updated upstream
 * @generated SignedSource<<a46a454ddc2a3b2b36b4f91b11528716>>
=======
 * @generated SignedSource<<4dbe1a1ac1ddb841d869b4076dd9b394>>
>>>>>>> Stashed changes
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvalAttr = "label" | "score";
export type SortDir = "asc" | "desc";
export type SpanColumn = "cumulativeTokenCountCompletion" | "cumulativeTokenCountPrompt" | "cumulativeTokenCountTotal" | "endTime" | "latencyMs" | "startTime" | "tokenCountCompletion" | "tokenCountPrompt" | "tokenCountTotal";
export type SpanSort = {
  col?: SpanColumn | null;
  dir: SortDir;
  evalResultKey?: EvalResultKey | null;
};
export type EvalResultKey = {
  attr: EvalAttr;
  name: string;
};
export type TracesTableQuery$variables = {
  after?: string | null;
  filterCondition?: string | null;
  first?: number | null;
  sort?: SpanSort | null;
};
export type TracesTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
};
export type TracesTableQuery = {
  response: TracesTableQuery$data;
  variables: TracesTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filterCondition"
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
v1 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v2 = {
  "kind": "Variable",
  "name": "filterCondition",
  "variableName": "filterCondition"
},
v3 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v4 = {
  "kind": "Variable",
  "name": "sort",
  "variableName": "sort"
},
v5 = [
  (v1/*: any*/),
  (v2/*: any*/),
  (v3/*: any*/),
  {
    "kind": "Literal",
    "name": "rootSpansOnly",
    "value": true
  },
  (v4/*: any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
  "name": "latencyMs",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v11 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
],
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v11/*: any*/),
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v11/*: any*/),
  "storageKey": null
},
v14 = {
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
},
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanEvaluation",
  "kind": "LinkedField",
  "name": "spanEvaluations",
  "plural": true,
  "selections": [
    (v7/*: any*/),
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
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TracesTableQuery",
    "selections": [
      {
        "args": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "kind": "FragmentSpread",
        "name": "TracesTable_spans"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TracesTableQuery",
    "selections": [
      {
        "alias": "rootSpans",
        "args": (v5/*: any*/),
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
                "alias": "rootSpan",
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v6/*: any*/),
                  (v7/*: any*/),
                  {
                    "alias": "statusCode",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cumulativeStatusCode",
                    "storageKey": null
                  },
                  (v8/*: any*/),
                  (v9/*: any*/),
                  {
                    "alias": "tokenCountTotal",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cumulativeTokenCountTotal",
                    "storageKey": null
                  },
                  {
                    "alias": "tokenCountPrompt",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cumulativeTokenCountPrompt",
                    "storageKey": null
                  },
                  {
                    "alias": "tokenCountCompletion",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cumulativeTokenCountCompletion",
                    "storageKey": null
                  },
                  (v10/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/),
                  (v14/*: any*/),
<<<<<<< Updated upstream
                  (v15/*: any*/),
                  (v16/*: any*/),
=======
>>>>>>> Stashed changes
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Span",
                    "kind": "LinkedField",
                    "name": "descendants",
                    "plural": true,
                    "selections": [
                      (v6/*: any*/),
                      (v7/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "statusCode",
                        "storageKey": null
                      },
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v10/*: any*/),
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
                        "kind": "ScalarField",
                        "name": "tokenCountPrompt",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "tokenCountCompletion",
                        "storageKey": null
                      },
                      (v12/*: any*/),
                      (v13/*: any*/),
<<<<<<< Updated upstream
                      (v14/*: any*/),
                      (v15/*: any*/),
                      (v16/*: any*/)
=======
                      (v14/*: any*/)
>>>>>>> Stashed changes
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
      },
      {
        "alias": "rootSpans",
        "args": (v5/*: any*/),
        "filters": [
          "sort",
          "rootSpansOnly",
          "filterCondition"
        ],
        "handle": "connection",
        "key": "TracesTable_rootSpans",
        "kind": "LinkedHandle",
        "name": "spans"
      }
    ]
  },
  "params": {
<<<<<<< Updated upstream
    "cacheID": "548b60c4c1410666b4f0533db3394b05",
=======
    "cacheID": "6a342b57b58f24bea32551f4cd971b40",
>>>>>>> Stashed changes
    "id": null,
    "metadata": {},
    "name": "TracesTableQuery",
    "operationKind": "query",
<<<<<<< Updated upstream
    "text": "query TracesTableQuery(\n  $after: String = null\n  $filterCondition: String = null\n  $first: Int = 100\n  $sort: SpanSort = {col: startTime, dir: desc}\n) {\n  ...TracesTable_spans_1XEuU\n}\n\nfragment TracesTable_spans_1XEuU on Query {\n  rootSpans: spans(first: $first, after: $after, sort: $sort, rootSpansOnly: true, filterCondition: $filterCondition) {\n    edges {\n      rootSpan: node {\n        spanKind\n        name\n        statusCode\n        startTime\n        latencyMs\n        tokenCountTotal: cumulativeTokenCountTotal\n        tokenCountPrompt: cumulativeTokenCountPrompt\n        tokenCountCompletion: cumulativeTokenCountCompletion\n        parentId\n        input {\n          value\n        }\n        output {\n          value\n        }\n        context {\n          spanId\n          traceId\n        }\n        spanEvaluations {\n          name\n          label\n          score\n        }\n        descendants {\n          spanKind\n          name\n          statusCode\n          startTime\n          latencyMs\n          parentId\n          tokenCountTotal\n          tokenCountPrompt\n          tokenCountCompletion\n          input {\n            value\n          }\n          output {\n            value\n          }\n          context {\n            spanId\n            traceId\n          }\n          spanEvaluations {\n            name\n            label\n            score\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
=======
    "text": "query TracesTableQuery(\n  $after: String = null\n  $filterCondition: String = null\n  $first: Int = 100\n  $sort: SpanSort = {col: startTime, dir: desc}\n) {\n  ...TracesTable_spans_1XEuU\n}\n\nfragment TracesTable_spans_1XEuU on Query {\n  rootSpans: spans(first: $first, after: $after, sort: $sort, rootSpansOnly: true, filterCondition: $filterCondition) {\n    edges {\n      rootSpan: node {\n        spanKind\n        name\n        statusCode: cumulativeStatusCode\n        startTime\n        latencyMs\n        tokenCountTotal: cumulativeTokenCountTotal\n        tokenCountPrompt: cumulativeTokenCountPrompt\n        tokenCountCompletion: cumulativeTokenCountCompletion\n        parentId\n        input {\n          value\n        }\n        output {\n          value\n        }\n        context {\n          spanId\n          traceId\n        }\n        descendants {\n          spanKind\n          name\n          statusCode\n          startTime\n          latencyMs\n          parentId\n          tokenCountTotal\n          tokenCountPrompt\n          tokenCountCompletion\n          input {\n            value\n          }\n          output {\n            value\n          }\n          context {\n            spanId\n            traceId\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
>>>>>>> Stashed changes
  }
};
})();

<<<<<<< Updated upstream
(node as any).hash = "601519f525b82c387835d8876bc3eab9";
=======
(node as any).hash = "a555ca43588dafbbeb4cdaf92938e73e";
>>>>>>> Stashed changes

export default node;
