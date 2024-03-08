/**
 * @generated SignedSource<<a96fe48a834c3d6e8623572517edca56>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
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
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
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
    "cacheID": "29583e7ec666cef832dc7effb9e75678",
    "id": null,
    "metadata": {},
    "name": "SpanFilterConditionFieldValidationQuery",
    "operationKind": "query",
    "text": "query SpanFilterConditionFieldValidationQuery(\n  $condition: String!\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      validateSpanFilterCondition(condition: $condition) {\n        isValid\n        errorMessage\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "22836f192038b0c40201d3b25aad65b4";

export default node;
