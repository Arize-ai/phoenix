/**
 * @generated SignedSource<<9339cea9d4994bb3839cec8f778285b9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionFilterColumn = "name";
export type DecisionFilter = {
  col: DecisionFilterColumn;
  value: string;
};
export type useTaskMenuOptionsDecisionsQuery$variables = {
  filter?: DecisionFilter | null;
  includeDecisions: boolean;
};
export type useTaskMenuOptionsDecisionsQuery$data = {
  readonly decisions?: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type useTaskMenuOptionsDecisionsQuery = {
  response: useTaskMenuOptionsDecisionsQuery$data;
  variables: useTaskMenuOptionsDecisionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includeDecisions"
  }
],
v1 = [
  {
    "condition": "includeDecisions",
    "kind": "Condition",
    "passingValue": true,
    "selections": [
      {
        "alias": null,
        "args": [
          {
            "kind": "Variable",
            "name": "filter",
            "variableName": "filter"
          },
          {
            "kind": "Literal",
            "name": "first",
            "value": 50
          }
        ],
        "concreteType": "DecisionConnection",
        "kind": "LinkedField",
        "name": "decisions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DecisionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Decision",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "name",
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
    ]
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useTaskMenuOptionsDecisionsQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useTaskMenuOptionsDecisionsQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "58a2f3901896c8d6ede88a6e2cfdffdb",
    "id": null,
    "metadata": {},
    "name": "useTaskMenuOptionsDecisionsQuery",
    "operationKind": "query",
    "text": "query useTaskMenuOptionsDecisionsQuery(\n  $filter: DecisionFilter\n  $includeDecisions: Boolean!\n) {\n  decisions(first: 50, filter: $filter) @include(if: $includeDecisions) {\n    edges {\n      node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e1dda885669862abfabd481a09110ba7";

export default node;
