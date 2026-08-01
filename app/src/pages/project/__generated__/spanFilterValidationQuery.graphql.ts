/**
 * @generated SignedSource<<f9fbe860fbf02528f80ce7ba18650f19>>
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
    readonly analyzeSpanFilterCondition?: {
      readonly selectsRootSpansOnly: boolean;
      readonly warnings: ReadonlyArray<{
        readonly identifier: string;
        readonly message: string;
        readonly suggestion: string | null;
      }>;
    };
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
v2 = [
  {
    "kind": "Variable",
    "name": "condition",
    "variableName": "condition"
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": (v2/*:: as any*/),
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
    },
    {
      "alias": null,
      "args": (v2/*:: as any*/),
      "concreteType": "SpanFilterConditionAnalysis",
      "kind": "LinkedField",
      "name": "analyzeSpanFilterCondition",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "selectsRootSpansOnly",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "FilterConditionWarning",
          "kind": "LinkedField",
          "name": "warnings",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "message",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "identifier",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "suggestion",
              "storageKey": null
            }
          ],
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
          (v3/*:: as any*/)
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
          (v3/*:: as any*/),
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
    "cacheID": "ec4d4a62fe7e6fa715c7541b32f0950f",
    "id": null,
    "metadata": {},
    "name": "spanFilterValidationQuery",
    "operationKind": "query",
    "text": "query spanFilterValidationQuery(\n  $condition: String!\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      validateSpanFilterCondition(condition: $condition) {\n        isValid\n        errorMessage\n      }\n      analyzeSpanFilterCondition(condition: $condition) {\n        selectsRootSpansOnly\n        warnings {\n          message\n          identifier\n          suggestion\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "a21d741b14dae0d172a82db2b85d1eef";

export default node;
