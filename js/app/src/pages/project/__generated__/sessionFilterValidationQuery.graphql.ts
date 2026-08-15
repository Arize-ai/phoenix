/**
 * @generated SignedSource<<a29b86fd850937692bbddcc920b8e517>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type sessionFilterValidationQuery$variables = {
  condition: string;
  id: string;
};
export type sessionFilterValidationQuery$data = {
  readonly project: {
    readonly validateSessionFilterCondition?: {
      readonly errorMessage: string | null;
      readonly isValid: boolean;
      readonly warnings: ReadonlyArray<string>;
    };
  };
};
export type sessionFilterValidationQuery = {
  response: sessionFilterValidationQuery$data;
  variables: sessionFilterValidationQuery$variables;
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
      "name": "validateSessionFilterCondition",
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "warnings",
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
    "name": "sessionFilterValidationQuery",
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
    "name": "sessionFilterValidationQuery",
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
    "cacheID": "f76cf703dfbaec78355fe38505a082d7",
    "id": null,
    "metadata": {},
    "name": "sessionFilterValidationQuery",
    "operationKind": "query",
    "text": "query sessionFilterValidationQuery(\n  $condition: String!\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      validateSessionFilterCondition(condition: $condition) {\n        isValid\n        errorMessage\n        warnings\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f3e5e411f5c6bc3ccfa316df29534547";

export default node;
