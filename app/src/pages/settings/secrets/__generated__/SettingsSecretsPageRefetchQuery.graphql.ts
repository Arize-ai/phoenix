/**
 * @generated SignedSource<<267d9e71b89b93f8543c58e1470aeedd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SettingsSecretsPageRefetchQuery$variables = Record<PropertyKey, never>;
export type SettingsSecretsPageRefetchQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SettingsSecretsPageFragment">;
};
export type SettingsSecretsPageRefetchQuery = {
  response: SettingsSecretsPageRefetchQuery$data;
  variables: SettingsSecretsPageRefetchQuery$variables;
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
    "name": "SettingsSecretsPageRefetchQuery",
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
    "name": "SettingsSecretsPageRefetchQuery",
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
    "cacheID": "ba78c830e8d2ac5e295edc43e7dae12e",
    "id": null,
    "metadata": {},
    "name": "SettingsSecretsPageRefetchQuery",
    "operationKind": "query",
    "text": "query SettingsSecretsPageRefetchQuery {\n  ...SettingsSecretsPageFragment\n}\n\nfragment SettingsSecretsPageFragment on Query {\n  secrets(first: 100) {\n    edges {\n      node {\n        id\n        key\n        updatedAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f693b67c9e54bcd6885167d74099636c";

export default node;
