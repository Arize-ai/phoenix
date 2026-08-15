/**
 * @generated SignedSource<<db3de505b4eaa60331c61ef514f01eac>>
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
export type ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation$variables = {
  input: UpsertOrDeleteSecretsMutationInput;
};
export type ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation$data = {
  readonly upsertOrDeleteSecrets: {
    readonly __typename: "UpsertOrDeleteSecretsMutationPayload";
  };
};
export type ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation = {
  response: ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation$data;
  variables: ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation$variables;
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
    "name": "ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "2dcd2226f5f3b64c1a02030b8dd7816d",
    "id": null,
    "metadata": {},
    "name": "ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation",
    "operationKind": "mutation",
    "text": "mutation ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation(\n  $input: UpsertOrDeleteSecretsMutationInput!\n) {\n  upsertOrDeleteSecrets(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "e861b44bbb1922da4b17ca12d6b304c9";

export default node;
