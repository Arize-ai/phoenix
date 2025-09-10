/**
 * @generated SignedSource<<1b04bd5d9e2ce3f1a984a502bfcc72d0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanFilterConditionFieldValidationQuery$variables = {
  condition: string;
  id: string;
};
export type SpanFilterConditionFieldValidationQuery$data = {
  readonly project: {
    readonly validateSpanFilterCondition?: {
      readonly errorMessage: string | null;
      readonly isValid: boolean;
    };
  };
};
export type SpanFilterConditionFieldValidationQuery = {
  response: SpanFilterConditionFieldValidationQuery$data;
  variables: SpanFilterConditionFieldValidationQuery$variables;
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanFilterConditionFieldValidationQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/)
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
    "name": "SpanFilterConditionFieldValidationQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
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
          (v2/*: any*/),
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
    "cacheID": "38e5e2288d5746b32b21632854cc7c82",
    "id": null,
    "metadata": {},
    "name": "SpanFilterConditionFieldValidationQuery",
    "operationKind": "query",
    "text": "query SpanFilterConditionFieldValidationQuery(\n  $condition: String!\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      validateSpanFilterCondition(condition: $condition) {\n        isValid\n        errorMessage\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "4020987ee29c63747be68dc3cada3de0";

export default node;
