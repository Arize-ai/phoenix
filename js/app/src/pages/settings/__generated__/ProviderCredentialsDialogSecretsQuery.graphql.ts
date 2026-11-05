/**
 * @generated SignedSource<<2fae12eb322689eff32c44a3042d2174>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProviderCredentialsDialogSecretsQuery$variables = {
  isAdmin: boolean;
  keys: ReadonlyArray<string>;
};
export type ProviderCredentialsDialogSecretsQuery$data = {
  readonly secrets?: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly key: string;
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
      };
    }>;
  };
};
export type ProviderCredentialsDialogSecretsQuery = {
  response: ProviderCredentialsDialogSecretsQuery$data;
  variables: ProviderCredentialsDialogSecretsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isAdmin"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "keys"
},
v2 = [
  {
    "kind": "Variable",
    "name": "keys",
    "variableName": "keys"
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
          "name": "parseError",
          "storageKey": null
        }
      ],
      "type": "UnparsableSecret",
      "abstractKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProviderCredentialsDialogSecretsQuery",
    "selections": [
      {
        "condition": "isAdmin",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v2/*:: as any*/),
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
                      (v3/*:: as any*/),
                      (v4/*:: as any*/)
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
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProviderCredentialsDialogSecretsQuery",
    "selections": [
      {
        "condition": "isAdmin",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v2/*:: as any*/),
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
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
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
        ]
      }
    ]
  },
  "params": {
    "cacheID": "e3ebd721d511cac6246b1a45e687803c",
    "id": null,
    "metadata": {},
    "name": "ProviderCredentialsDialogSecretsQuery",
    "operationKind": "query",
    "text": "query ProviderCredentialsDialogSecretsQuery(\n  $keys: [String!]!\n  $isAdmin: Boolean!\n) {\n  secrets(keys: $keys) @include(if: $isAdmin) {\n    edges {\n      node {\n        key\n        value {\n          __typename\n          ... on DecryptedSecret {\n            value\n          }\n          ... on UnparsableSecret {\n            parseError\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3aa47f6223e6f345420fa8b939ca9375";

export default node;
