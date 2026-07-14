/**
 * @generated SignedSource<<e0b71c66b8834ffa2927bbdb95437c46>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteApiKeyInput = {
  id: string;
};
export type UserAPIKeysTableDeleteAPIKeyMutation$variables = {
  input: DeleteApiKeyInput;
};
export type UserAPIKeysTableDeleteAPIKeyMutation$data = {
  readonly deleteUserApiKey: {
    readonly __typename: "DeleteApiKeyMutationPayload";
    readonly apiKeyId: string;
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
        "name": "apiKeyId",
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
    "name": "UserAPIKeysTableDeleteAPIKeyMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "UserAPIKeysTableDeleteAPIKeyMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "d137498515ff43864f5525b3c1847376",
    "id": null,
    "metadata": {},
    "name": "UserAPIKeysTableDeleteAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation UserAPIKeysTableDeleteAPIKeyMutation(\n  $input: DeleteApiKeyInput!\n) {\n  deleteUserApiKey(input: $input) {\n    __typename\n    apiKeyId\n  }\n}\n"
  }
};
})();

(node as any).hash = "9b1d898d1d9858016bed85000ce3906e";

export default node;
