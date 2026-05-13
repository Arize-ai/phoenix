/**
 * @generated SignedSource<<69b6b27b959b46efdf7a0b319e91e453>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxConfigLabelDetailsQuery$variables = {
  canManageSandboxes: boolean;
  id: string;
};
export type SandboxConfigLabelDetailsQuery$data = {
  readonly node: {
    readonly __typename: "SandboxConfig";
    readonly config?: any;
    readonly timeout: number;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SandboxConfigLabelDetailsQuery = {
  response: SandboxConfigLabelDetailsQuery$data;
  variables: SandboxConfigLabelDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "canManageSandboxes"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "timeout",
      "storageKey": null
    },
    {
      "condition": "canManageSandboxes",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "config",
          "storageKey": null
        }
      ]
    }
  ],
  "type": "SandboxConfig",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SandboxConfigLabelDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "SandboxConfigLabelDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
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
    "cacheID": "1393c008b2581ba66c111a61cd6c9d23",
    "id": null,
    "metadata": {},
    "name": "SandboxConfigLabelDetailsQuery",
    "operationKind": "query",
    "text": "query SandboxConfigLabelDetailsQuery(\n  $id: ID!\n  $canManageSandboxes: Boolean!\n) {\n  node(id: $id) {\n    __typename\n    ... on SandboxConfig {\n      timeout\n      config @include(if: $canManageSandboxes)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "77b090e6f1f4a3a3ea6ae015e6a20edc";

export default node;
