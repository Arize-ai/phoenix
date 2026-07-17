/**
 * @generated SignedSource<<9ff5c1a4b936938150eb0e518031ccfe>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProviderServerCredentialsPanelSecretsQuery$variables = {
  secretKeys: ReadonlyArray<string>;
};
export type ProviderServerCredentialsPanelSecretsQuery$data = {
  readonly secrets: {
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
export type ProviderServerCredentialsPanelSecretsQuery = {
  response: ProviderServerCredentialsPanelSecretsQuery$data;
  variables: ProviderServerCredentialsPanelSecretsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "secretKeys"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "keys",
    "variableName": "secretKeys"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "key",
  "storageKey": null
},
v3 = {
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProviderServerCredentialsPanelSecretsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                  (v2/*:: as any*/),
                  (v3/*:: as any*/)
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
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProviderServerCredentialsPanelSecretsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                  (v2/*:: as any*/),
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
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8ad50d7bc3e7cc20678d5cfc8b7584b4",
    "id": null,
    "metadata": {},
    "name": "ProviderServerCredentialsPanelSecretsQuery",
    "operationKind": "query",
    "text": "query ProviderServerCredentialsPanelSecretsQuery(\n  $secretKeys: [String!]!\n) {\n  secrets(keys: $secretKeys) {\n    edges {\n      node {\n        key\n        value {\n          __typename\n          ... on DecryptedSecret {\n            value\n          }\n          ... on UnparsableSecret {\n            parseError\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "76249629a41742e8efbd25a0370219b7";

export default node;
