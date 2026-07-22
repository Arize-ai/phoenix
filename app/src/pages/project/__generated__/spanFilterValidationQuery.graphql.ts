/**
 * @generated SignedSource<<90cbc4c31d766293f76dc932c90d282f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type spanFilterValidationQuery$variables = {
  condition: string;
  id: string;
};
export type spanFilterValidationQuery$data = {
  readonly project: {
    readonly validateSpanFilterCondition?: {
      readonly errorMessage: string | null;
      readonly isValid: boolean;
    };
  };
};
export type spanFilterValidationQuery = {
  response: spanFilterValidationQuery$data;
  variables: spanFilterValidationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "condition"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "condition",
          "variableName": "condition"
        }
      ],
      "concreteType": "ValidationResult",
      "kind": "LinkedField",
      "name": "validateSpanFilterCondition",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isValid",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "errorMessage",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "spanFilterValidationQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "spanFilterValidationQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
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
          },
          (v2/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "dca4d0bdb192680d6375719b71aa12e1",
    "id": null,
    "metadata": {},
    "name": "spanFilterValidationQuery",
    "operationKind": "query",
    "text": "query spanFilterValidationQuery(\n  $condition: String!\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      validateSpanFilterCondition(condition: $condition) {\n        isValid\n        errorMessage\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "4fbbe426b77211de9644c0c62b947d20";

export default node;
