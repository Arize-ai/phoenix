/**
 * @generated SignedSource<<c8d78878b8cd6ea22cf6b36c14994685>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UpsertOrDeleteSecretsMutationInput = {
  secrets: ReadonlyArray<SecretKeyValueInput>;
};
export type SecretKeyValueInput = {
  key: string;
  value?: string | null;
};
export type ProviderCredentialsDialogSaveSecretsMutation$variables = {
  input: UpsertOrDeleteSecretsMutationInput;
};
export type ProviderCredentialsDialogSaveSecretsMutation$data = {
  readonly upsertOrDeleteSecrets: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"GenerativeProvidersCard_data">;
    };
  };
};
export type ProviderCredentialsDialogSaveSecretsMutation = {
  response: ProviderCredentialsDialogSaveSecretsMutation$data;
  variables: ProviderCredentialsDialogSaveSecretsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProviderCredentialsDialogSaveSecretsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpsertOrDeleteSecretsMutationPayload",
        "kind": "LinkedField",
        "name": "upsertOrDeleteSecrets",
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
                "args": null,
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProviderCredentialsDialogSaveSecretsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpsertOrDeleteSecretsMutationPayload",
        "kind": "LinkedField",
        "name": "upsertOrDeleteSecrets",
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
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "isSetInEnvironment",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "isSetAsSecret",
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
    "cacheID": "37f7c2228165e56a840e611440ad2948",
    "id": null,
    "metadata": {},
    "name": "ProviderCredentialsDialogSaveSecretsMutation",
    "operationKind": "mutation",
    "text": "mutation ProviderCredentialsDialogSaveSecretsMutation(\n  $input: UpsertOrDeleteSecretsMutationInput!\n) {\n  upsertOrDeleteSecrets(input: $input) {\n    query {\n      ...GenerativeProvidersCard_data\n    }\n  }\n}\n\nfragment GenerativeProvidersCard_data on Query {\n  modelProviders {\n    name\n    key\n    dependenciesInstalled\n    dependencies\n    credentialRequirements {\n      envVarName\n      isRequired\n      isSetInEnvironment\n      isSetAsSecret\n    }\n    credentialsSet\n  }\n}\n"
  }
};
})();

(node as any).hash = "2cbc863a0681475db1a6a3ebaad14c44";

export default node;
