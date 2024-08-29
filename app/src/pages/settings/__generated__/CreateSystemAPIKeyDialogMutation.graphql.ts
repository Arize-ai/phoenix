/**
 * @generated SignedSource<<c09063051d7da2308dafeb2dd8b09ec5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateSystemAPIKeyDialogMutation$variables = {
  description?: string | null;
  expiresAt?: string | null;
  name: string;
};
export type CreateSystemAPIKeyDialogMutation$data = {
  readonly createSystemApiKey: {
    readonly apiKey: {
      readonly id: string;
    };
    readonly jwt: string;
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment">;
    };
  };
};
export type CreateSystemAPIKeyDialogMutation = {
  response: CreateSystemAPIKeyDialogMutation$data;
  variables: CreateSystemAPIKeyDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "expiresAt"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v3 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "description",
        "variableName": "description"
      },
      {
        "kind": "Variable",
        "name": "expiresAt",
        "variableName": "expiresAt"
      },
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "jwt",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "SystemApiKey",
  "kind": "LinkedField",
  "name": "apiKey",
  "plural": false,
  "selections": [
    (v5/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateSystemAPIKeyDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "CreateSystemApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "createSystemApiKey",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SystemAPIKeysTableFragment"
              }
            ],
            "storageKey": null
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "CreateSystemAPIKeyDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "CreateSystemApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "createSystemApiKey",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "SystemApiKey",
                "kind": "LinkedField",
                "name": "systemApiKeys",
                "plural": true,
                "selections": [
                  (v5/*: any*/),
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
                    "name": "description",
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
                    "name": "expiresAt",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e162ef32e40e2920bbdb388bedd83989",
    "id": null,
    "metadata": {},
    "name": "CreateSystemAPIKeyDialogMutation",
    "operationKind": "mutation",
    "text": "mutation CreateSystemAPIKeyDialogMutation(\n  $name: String!\n  $description: String = null\n  $expiresAt: DateTime = null\n) {\n  createSystemApiKey(input: {name: $name, description: $description, expiresAt: $expiresAt}) {\n    jwt\n    query {\n      ...SystemAPIKeysTableFragment\n    }\n    apiKey {\n      id\n    }\n  }\n}\n\nfragment SystemAPIKeysTableFragment on Query {\n  systemApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "8e8563676b39f1e44ef4bac4057ef7e3";

export default node;
