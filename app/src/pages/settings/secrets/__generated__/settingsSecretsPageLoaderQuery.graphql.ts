/**
 * @generated SignedSource<<991d9e9a5f8f70f157d73b2c99e10733>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsSecretsPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsSecretsPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SettingsSecretsPageFragment">;
};
export type settingsSecretsPageLoaderQuery = {
  response: settingsSecretsPageLoaderQuery$data;
  variables: settingsSecretsPageLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "settingsSecretsPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "SettingsSecretsPageFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsSecretsPageLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": [
          {
            "kind": "Literal",
            "name": "first",
            "value": 100
          }
        ],
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
                  (v0/*: any*/),
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
                      (v0/*: any*/),
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
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "secrets(first:100)"
      }
    ]
  },
  "params": {
    "cacheID": "6a0bb21095b0b47b03502ed476909d25",
    "id": null,
    "metadata": {},
    "name": "settingsSecretsPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsSecretsPageLoaderQuery {\n  ...SettingsSecretsPageFragment\n}\n\nfragment SettingsSecretsPageFragment on Query {\n  secrets(first: 100) {\n    edges {\n      node {\n        id\n        key\n        updatedAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "57c49c3b2cca95acc5169971e33ab1d6";

export default node;
