/**
 * @generated SignedSource<<322b1824668c9d0e90c35b740f17552f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type DeleteApiKeyInput = {
  id: string;
};
export type APIKeysTableDeleteAPIKeyMutation$variables = {
  input: DeleteApiKeyInput;
};
export type APIKeysTableDeleteAPIKeyMutation$data = {
  readonly deleteUserApiKey: {
    readonly __typename: "DeleteApiKeyMutationPayload";
    readonly apiKeyId: string;
  };
};
export type APIKeysTableDeleteAPIKeyMutation = {
  response: APIKeysTableDeleteAPIKeyMutation$data;
  variables: APIKeysTableDeleteAPIKeyMutation$variables;
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
    "concreteType": "DeleteApiKeyMutationPayload",
    "kind": "LinkedField",
    "name": "deleteUserApiKey",
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
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "apiKeyId",
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
    "name": "APIKeysTableDeleteAPIKeyMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "APIKeysTableDeleteAPIKeyMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d13b3c3fd663b53c64f8248e3a039474",
    "id": null,
    "metadata": {},
    "name": "APIKeysTableDeleteAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation APIKeysTableDeleteAPIKeyMutation(\n  $input: DeleteApiKeyInput!\n) {\n  deleteUserApiKey(input: $input) {\n    __typename\n    apiKeyId\n  }\n}\n"
  }
};
})();

(node as any).hash = "62474b95d8f111ae06a4839a0a3d15d9";

export default node;
