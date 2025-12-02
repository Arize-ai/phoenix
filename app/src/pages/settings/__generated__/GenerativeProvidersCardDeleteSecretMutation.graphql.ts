/**
 * @generated SignedSource<<b6be00b3fb6063f2252ef39caddffb17>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteSecretMutationInput = {
  keys: ReadonlyArray<string>;
};
export type GenerativeProvidersCardDeleteSecretMutation$variables = {
  input: DeleteSecretMutationInput;
  secretKeys: ReadonlyArray<string>;
};
export type GenerativeProvidersCardDeleteSecretMutation$data = {
  readonly deleteSecret: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"GenerativeProvidersCard_data">;
    };
  };
};
export type GenerativeProvidersCardDeleteSecretMutation = {
  response: GenerativeProvidersCardDeleteSecretMutation$data;
  variables: GenerativeProvidersCardDeleteSecretMutation$variables;
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
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "key",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "GenerativeProvidersCardDeleteSecretMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteSecretMutationPayload",
        "kind": "LinkedField",
        "name": "deleteSecret",
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
                "args": [
                  {
                    "kind": "Variable",
                    "name": "secretKeys",
                    "variableName": "secretKeys"
                  }
                ],
                "kind": "FragmentSpread",
                "name": "GenerativeProvidersCard_data"
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
    "name": "GenerativeProvidersCardDeleteSecretMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteSecretMutationPayload",
        "kind": "LinkedField",
        "name": "deleteSecret",
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
                "args": null,
                "concreteType": "GenerativeProvider",
                "kind": "LinkedField",
                "name": "modelProviders",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "name",
                    "storageKey": null
                  },
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "dependenciesInstalled",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "dependencies",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "GenerativeProviderCredentialConfig",
                    "kind": "LinkedField",
                    "name": "credentialRequirements",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "envVarName",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "isRequired",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "credentialsSet",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Variable",
                    "name": "keys",
                    "variableName": "secretKeys"
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
                          (v2/*: any*/),
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
                                    "name": "maskedValue",
                                    "storageKey": null
                                  }
                                ],
                                "type": "MaskedSecret",
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
                          },
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
    "cacheID": "6657a75b58abb7d11a1927a6cb17aa9a",
    "id": null,
    "metadata": {},
    "name": "GenerativeProvidersCardDeleteSecretMutation",
    "operationKind": "mutation",
    "text": "mutation GenerativeProvidersCardDeleteSecretMutation(\n  $input: DeleteSecretMutationInput!\n  $secretKeys: [String!]!\n) {\n  deleteSecret(input: $input) {\n    query {\n      ...GenerativeProvidersCard_data_2LmOnK\n    }\n  }\n}\n\nfragment GenerativeProvidersCard_data_2LmOnK on Query {\n  modelProviders {\n    name\n    key\n    dependenciesInstalled\n    dependencies\n    credentialRequirements {\n      envVarName\n      isRequired\n    }\n    credentialsSet\n  }\n  secrets(keys: $secretKeys) {\n    edges {\n      node {\n        key\n        value {\n          __typename\n          ... on DecryptedSecret {\n            value\n          }\n          ... on MaskedSecret {\n            maskedValue\n          }\n          ... on UnparsableSecret {\n            parseError\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1a135aeb8edbd64a22e096fd01473672";

export default node;
