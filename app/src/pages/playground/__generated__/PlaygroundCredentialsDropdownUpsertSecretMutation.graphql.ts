/**
 * @generated SignedSource<<8f0411717a285a6ab5826744d118119e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UpsertSecretMutationInput = {
  secrets: ReadonlyArray<SecretKeyValueInput>;
};
export type SecretKeyValueInput = {
  key: string;
  value: string;
};
export type PlaygroundCredentialsDropdownUpsertSecretMutation$variables = {
  input: UpsertSecretMutationInput;
  secretKeys: ReadonlyArray<string>;
};
export type PlaygroundCredentialsDropdownUpsertSecretMutation$data = {
  readonly upsertSecret: {
    readonly query: {
      readonly secrets: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly key: string;
            readonly value: {
              readonly __typename: "DecryptedSecret";
              readonly value: string;
            } | {
              readonly __typename: "HiddenSecret";
              readonly maskedValue: string;
            } | {
              // This will never be '%other', but we need some
              // value in case none of the concrete values match.
              readonly __typename: "%other";
            };
          };
        }>;
      };
    };
  };
};
export type PlaygroundCredentialsDropdownUpsertSecretMutation = {
  response: PlaygroundCredentialsDropdownUpsertSecretMutation$data;
  variables: PlaygroundCredentialsDropdownUpsertSecretMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "secretKeys"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "keys",
    "variableName": "secretKeys"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "key",
  "storageKey": null
},
v4 = {
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
          "name": "maskedValue",
          "storageKey": null
        }
      ],
      "type": "HiddenSecret",
      "abstractKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundCredentialsDropdownUpsertSecretMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UpsertSecretMutationPayload",
        "kind": "LinkedField",
        "name": "upsertSecret",
        "plural": false,
        "selections": [
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
                "args": (v2/*: any*/),
                "concreteType": "SecretConnection",
                "kind": "LinkedField",
                "name": "secrets",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SecretEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Secret",
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
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundCredentialsDropdownUpsertSecretMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UpsertSecretMutationPayload",
        "kind": "LinkedField",
        "name": "upsertSecret",
        "plural": false,
        "selections": [
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
                "args": (v2/*: any*/),
                "concreteType": "SecretConnection",
                "kind": "LinkedField",
                "name": "secrets",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SecretEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Secret",
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
                    ],
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
  },
  "params": {
    "cacheID": "cd5638f4ea97478f922cd5c6cb477ce6",
    "id": null,
    "metadata": {},
    "name": "PlaygroundCredentialsDropdownUpsertSecretMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundCredentialsDropdownUpsertSecretMutation(\n  $input: UpsertSecretMutationInput!\n  $secretKeys: [String!]!\n) {\n  upsertSecret(input: $input) {\n    query {\n      secrets(keys: $secretKeys) {\n        edges {\n          node {\n            key\n            value {\n              __typename\n              ... on DecryptedSecret {\n                value\n              }\n              ... on HiddenSecret {\n                maskedValue\n              }\n            }\n            id\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0ec95c77a03796efa723ba1d62768f28";

export default node;
