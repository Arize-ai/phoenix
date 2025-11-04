/**
 * @generated SignedSource<<3abdfcc78b20aadad913ad5a264dccd1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorsTableEvaluatorsQuery$variables = {
  after?: string | null;
  first?: number | null;
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
    "defaultValue": 100,
    "kind": "LocalArgument",
    "name": "first"
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
    "name": "first",
    "variableName": "first"
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
        "filters": null,
        "handle": "connection",
        "key": "EvaluatorsTable_evaluators",
        "kind": "LinkedHandle",
        "name": "evaluators"
      }
    ]
  },
  "params": {
    "cacheID": "e95cdea16c6351eb786a2d736b5ebb1c",
    "id": null,
    "metadata": {},
    "name": "EvaluatorsTableEvaluatorsQuery",
    "operationKind": "query",
    "text": "query EvaluatorsTableEvaluatorsQuery(\n  $after: String = null\n  $first: Int = 100\n) {\n  ...EvaluatorsTable_evaluators_2HEEH6\n}\n\nfragment EvaluatorsTable_evaluators_2HEEH6 on Query {\n  evaluators(first: $first, after: $after) {\n    edges {\n      evaluator: node {\n        __typename\n        id\n        name\n        createdAt\n        updatedAt\n        description\n        kind\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "106500fd3f48e71ec93bedbd11242e6f";

export default node;
