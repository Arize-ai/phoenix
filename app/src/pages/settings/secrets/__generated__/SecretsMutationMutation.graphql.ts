/**
 * @generated SignedSource<<8f77657804562f568c57c86d54352a3b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UpsertOrDeleteSecretsMutationInput = {
  secrets: ReadonlyArray<SecretKeyValueInput>;
};
export type SecretKeyValueInput = {
  key: string;
  value?: string | null;
};
export type SecretsMutationMutation$variables = {
  connections: ReadonlyArray<string>;
  input: UpsertOrDeleteSecretsMutationInput;
};
export type SecretsMutationMutation$data = {
  readonly upsertOrDeleteSecrets: {
    readonly deletedIds: ReadonlyArray<string>;
    readonly upsertedSecrets: ReadonlyArray<{
      readonly id: string;
      readonly key: string;
      readonly updatedAt: string;
      readonly user: {
        readonly id: string;
        readonly profilePictureUrl: string | null;
        readonly username: string;
      } | null;
    }>;
  };
};
export type SecretsMutationMutation = {
  response: SecretsMutationMutation$data;
  variables: SecretsMutationMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "Secret",
  "kind": "LinkedField",
  "name": "upsertedSecrets",
  "plural": true,
  "selections": [
    (v3/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "key",
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
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "user",
      "plural": false,
      "selections": [
        (v3/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "username",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "profilePictureUrl",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "deletedIds",
  "storageKey": null
},
v6 = {
  "kind": "Variable",
  "name": "connections",
  "variableName": "connections"
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SecretsMutationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "UpsertOrDeleteSecretsMutationPayload",
        "kind": "LinkedField",
        "name": "upsertOrDeleteSecrets",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v5/*: any*/)
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
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "SecretsMutationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "UpsertOrDeleteSecretsMutationPayload",
        "kind": "LinkedField",
        "name": "upsertOrDeleteSecrets",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "upsertedSecrets",
            "handleArgs": [
              (v6/*: any*/),
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "SecretEdge"
              }
            ]
          },
          (v5/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "deletedIds",
            "handleArgs": [
              (v6/*: any*/)
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "78687ca4cb391bedea4d4cffe9d0484a",
    "id": null,
    "metadata": {},
    "name": "SecretsMutationMutation",
    "operationKind": "mutation",
    "text": "mutation SecretsMutationMutation(\n  $input: UpsertOrDeleteSecretsMutationInput!\n) {\n  upsertOrDeleteSecrets(input: $input) {\n    upsertedSecrets {\n      id\n      key\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n    }\n    deletedIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "ac158c2cca394523ea36111a27ad7cff";

export default node;
