/**
 * @generated SignedSource<<2534d595c3e9b65466373e66650fdfc7>>
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
export type SecretsMutationMutation$variables = {
  input: UpsertOrDeleteSecretsMutationInput;
};
export type SecretsMutationMutation$data = {
  readonly upsertOrDeleteSecrets: {
    readonly __typename: "UpsertOrDeleteSecretsMutationPayload";
  };
};
export type SecretsMutationMutation = {
  response: SecretsMutationMutation$data;
  variables: SecretsMutationMutation$variables;
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
    "name": "SecretsMutationMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SecretsMutationMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "188290e4d91908596225d3ddd39e7f64",
    "id": null,
    "metadata": {},
    "name": "SecretsMutationMutation",
    "operationKind": "mutation",
    "text": "mutation SecretsMutationMutation(\n  $input: UpsertOrDeleteSecretsMutationInput!\n) {\n  upsertOrDeleteSecrets(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "860d8a43efd1c77441679a28b8b3f1c1";

export default node;
