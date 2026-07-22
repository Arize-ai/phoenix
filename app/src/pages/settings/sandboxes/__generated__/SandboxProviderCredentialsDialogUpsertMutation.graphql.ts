/**
 * @generated SignedSource<<86bc870171788cb37e091888f9f0ff2a>>
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
export type SandboxProviderCredentialsDialogUpsertMutation$variables = {
  input: UpsertOrDeleteSecretsMutationInput;
};
export type SandboxProviderCredentialsDialogUpsertMutation$data = {
  readonly upsertOrDeleteSecrets: {
    readonly __typename: "UpsertOrDeleteSecretsMutationPayload";
  };
};
export type SandboxProviderCredentialsDialogUpsertMutation = {
  response: SandboxProviderCredentialsDialogUpsertMutation$data;
  variables: SandboxProviderCredentialsDialogUpsertMutation$variables;
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SandboxProviderCredentialsDialogUpsertMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SandboxProviderCredentialsDialogUpsertMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "a775a5f565425ed85902547d8bc52df8",
    "id": null,
    "metadata": {},
    "name": "SandboxProviderCredentialsDialogUpsertMutation",
    "operationKind": "mutation",
    "text": "mutation SandboxProviderCredentialsDialogUpsertMutation(\n  $input: UpsertOrDeleteSecretsMutationInput!\n) {\n  upsertOrDeleteSecrets(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "faec43c877e07052b1acfb5c81f2efb1";

export default node;
