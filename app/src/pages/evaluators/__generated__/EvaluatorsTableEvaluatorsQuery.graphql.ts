/**
 * @generated SignedSource<<bd0ca64ffb6a3fc066649206363db569>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorColumn = "createdAt" | "kind" | "name" | "updatedAt";
export type EvaluatorFilterColumn = "name";
export type SortDir = "asc" | "desc";
export type EvaluatorFilter = {
  col: EvaluatorFilterColumn;
  value: string;
};
export type EvaluatorSort = {
  col: EvaluatorColumn;
  dir: SortDir;
};
export type EvaluatorsTableEvaluatorsQuery$variables = {
  after?: string | null;
  filter?: EvaluatorFilter | null;
  first?: number | null;
  sort?: EvaluatorSort | null;
};
export type EvaluatorsTableEvaluatorsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorsTable_evaluators">;
};
export type EvaluatorsTableEvaluatorsQuery = {
  response: EvaluatorsTableEvaluatorsQuery$data;
  variables: EvaluatorsTableEvaluatorsQuery$variables;
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
    "name": "filter"
  },
  {
    "defaultValue": 100,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sort"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorsTableEvaluatorsQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "EvaluatorsTable_evaluators"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EvaluatorsTableEvaluatorsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "EvaluatorConnection",
        "kind": "LinkedField",
        "name": "evaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "EvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": "evaluator",
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
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
                    "name": "createdAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "updatedAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "description",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "kind",
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
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/)
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
        "alias": null,
        "args": (v1/*: any*/),
        "filters": [
          "sort",
          "filter"
        ],
        "handle": "connection",
        "key": "EvaluatorsTable_evaluators",
        "kind": "LinkedHandle",
        "name": "evaluators"
      }
    ]
  },
  "params": {
    "cacheID": "b2015d4a299dfeb869d1afe292db5c98",
    "id": null,
    "metadata": {},
    "name": "EvaluatorsTableEvaluatorsQuery",
    "operationKind": "query",
    "text": "query EvaluatorsTableEvaluatorsQuery(\n  $after: String = null\n  $filter: EvaluatorFilter = null\n  $first: Int = 100\n  $sort: EvaluatorSort = null\n) {\n  ...EvaluatorsTable_evaluators_3JsJJ3\n}\n\nfragment EvaluatorsTable_evaluators_3JsJJ3 on Query {\n  evaluators(first: $first, after: $after, sort: $sort, filter: $filter) {\n    edges {\n      evaluator: node {\n        __typename\n        id\n        name\n        createdAt\n        updatedAt\n        description\n        kind\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ac63a15202ef4786656d0502a6bb7165";

export default node;
