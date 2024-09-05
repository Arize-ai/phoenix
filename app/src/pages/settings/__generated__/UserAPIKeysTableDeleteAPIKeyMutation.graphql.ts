/**
 * @generated SignedSource<<f9ef4901d09c0228d4e7175436ebfc79>>
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
export type UserAPIKeysTableDeleteAPIKeyMutation$variables = {
  input: DeleteApiKeyInput;
};
export type UserAPIKeysTableDeleteAPIKeyMutation$data = {
  readonly deleteUserApiKey: {
    readonly __typename: "DeleteApiKeyMutationPayload";
    readonly id: string;
  };
};
export type UserAPIKeysTableDeleteAPIKeyMutation = {
  response: UserAPIKeysTableDeleteAPIKeyMutation$data;
  variables: UserAPIKeysTableDeleteAPIKeyMutation$variables;
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
        "name": "id",
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
    "name": "UserAPIKeysTableDeleteAPIKeyMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UserAPIKeysTableDeleteAPIKeyMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4e73db7c72af299cfa2069f05d33aeae",
    "id": null,
    "metadata": {},
    "name": "UserAPIKeysTableDeleteAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation UserAPIKeysTableDeleteAPIKeyMutation(\n  $input: DeleteApiKeyInput!\n) {\n  deleteUserApiKey(input: $input) {\n    __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "47c0e1bc378e71f6a8c7929e2ac8d8f4";

export default node;
