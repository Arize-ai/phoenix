/**
 * @generated SignedSource<<16dc08c481bc4e810aeb6fa421d9eebe>>
 * @lightSyntaxTransform
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
      readonly value: {
        readonly __typename: "DecryptedSecret";
        readonly value: string;
      } | {
        readonly __typename: "UnparsableSecret";
        readonly parseError: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
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
    (v3/*:: as any*/),
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
        (v3/*:: as any*/),
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
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "value",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "__typename",
          "storageKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "value",
              "storageKey": null
            }
          ],
          "type": "DecryptedSecret",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "parseError",
              "storageKey": null
            }
          ],
          "type": "UnparsableSecret",
          "abstractKey": null
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
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SecretsMutationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "UpsertOrDeleteSecretsMutationPayload",
        "kind": "LinkedField",
        "name": "upsertOrDeleteSecrets",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          (v5/*:: as any*/)
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SecretsMutationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "UpsertOrDeleteSecretsMutationPayload",
        "kind": "LinkedField",
        "name": "upsertOrDeleteSecrets",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "upsertedSecrets",
            "handleArgs": [
              (v6/*:: as any*/),
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "SecretEdge"
              }
            ]
          },
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "deletedIds",
            "handleArgs": [
              (v6/*:: as any*/)
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "94bbf840ef147ffbbf93fd0612dab60e",
    "id": null,
    "metadata": {},
    "name": "SecretsMutationMutation",
    "operationKind": "mutation",
    "text": "mutation SecretsMutationMutation(\n  $input: UpsertOrDeleteSecretsMutationInput!\n) {\n  upsertOrDeleteSecrets(input: $input) {\n    upsertedSecrets {\n      id\n      key\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n      value {\n        __typename\n        ... on DecryptedSecret {\n          value\n        }\n        ... on UnparsableSecret {\n          parseError\n        }\n      }\n    }\n    deletedIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "4c845f6228365664e81a6d181028147b";

export default node;
