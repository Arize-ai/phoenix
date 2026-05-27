/**
 * @generated SignedSource<<dfdc564e43635569a43558fc6c0aff1c>>
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
export type ProviderCredentialsDialogUpsertOrDeleteSecretsMutation$variables = {
  input: UpsertOrDeleteSecretsMutationInput;
};
export type ProviderCredentialsDialogUpsertOrDeleteSecretsMutation$data = {
  readonly upsertOrDeleteSecrets: {
    readonly __typename: "UpsertOrDeleteSecretsMutationPayload";
  };
};
export type ProviderCredentialsDialogUpsertOrDeleteSecretsMutation = {
  response: ProviderCredentialsDialogUpsertOrDeleteSecretsMutation$data;
  variables: ProviderCredentialsDialogUpsertOrDeleteSecretsMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "UpsertOrDeleteSecretsMutationPayload",
    "kind": "LinkedField",
    "name": "upsertOrDeleteSecrets",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProviderCredentialsDialogUpsertOrDeleteSecretsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProviderCredentialsDialogUpsertOrDeleteSecretsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "52b7a4fd1d622790adebc0a9a6d83e28",
    "id": null,
    "metadata": {},
    "name": "ProviderCredentialsDialogUpsertOrDeleteSecretsMutation",
    "operationKind": "mutation",
    "text": "mutation ProviderCredentialsDialogUpsertOrDeleteSecretsMutation(\n  $input: UpsertOrDeleteSecretsMutationInput!\n) {\n  upsertOrDeleteSecrets(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "cdfc1d25e2619b8d75ba7ad3708a7330";

export default node;
