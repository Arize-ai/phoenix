/**
 * @generated SignedSource<<500f74d2257b491090ccc3df0e8394d7>>
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
export type GenerativeProvidersCardUpsertOrDeleteSecretsMutation$variables = {
  input: UpsertOrDeleteSecretsMutationInput;
};
export type GenerativeProvidersCardUpsertOrDeleteSecretsMutation$data = {
  readonly upsertOrDeleteSecrets: {
    readonly __typename: "UpsertOrDeleteSecretsMutationPayload";
  };
};
export type GenerativeProvidersCardUpsertOrDeleteSecretsMutation = {
  response: GenerativeProvidersCardUpsertOrDeleteSecretsMutation$data;
  variables: GenerativeProvidersCardUpsertOrDeleteSecretsMutation$variables;
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
    "name": "GenerativeProvidersCardUpsertOrDeleteSecretsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "GenerativeProvidersCardUpsertOrDeleteSecretsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "902d45c0dd8a7323d533a7d59df6081e",
    "id": null,
    "metadata": {},
    "name": "GenerativeProvidersCardUpsertOrDeleteSecretsMutation",
    "operationKind": "mutation",
    "text": "mutation GenerativeProvidersCardUpsertOrDeleteSecretsMutation(\n  $input: UpsertOrDeleteSecretsMutationInput!\n) {\n  upsertOrDeleteSecrets(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "3346ee8bb8e24a09a2bf6ce7b5d1cb6d";

export default node;
