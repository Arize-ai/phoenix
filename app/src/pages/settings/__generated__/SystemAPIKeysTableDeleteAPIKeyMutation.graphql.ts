/**
 * @generated SignedSource<<b3f380e0e8f6bb23e27d5962ba467043>>
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
export type SystemAPIKeysTableDeleteAPIKeyMutation$variables = {
  input: DeleteApiKeyInput;
};
export type SystemAPIKeysTableDeleteAPIKeyMutation$data = {
  readonly deleteSystemApiKey: {
    readonly __typename: "DeleteApiKeyMutationPayload";
    readonly id: string;
  };
};
export type SystemAPIKeysTableDeleteAPIKeyMutation = {
  response: SystemAPIKeysTableDeleteAPIKeyMutation$data;
  variables: SystemAPIKeysTableDeleteAPIKeyMutation$variables;
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
    "name": "deleteSystemApiKey",
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
    "name": "SystemAPIKeysTableDeleteAPIKeyMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SystemAPIKeysTableDeleteAPIKeyMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "c65d1d86f282379c1f529a7234b60120",
    "id": null,
    "metadata": {},
    "name": "SystemAPIKeysTableDeleteAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation SystemAPIKeysTableDeleteAPIKeyMutation(\n  $input: DeleteApiKeyInput!\n) {\n  deleteSystemApiKey(input: $input) {\n    __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5b7f3beaf38ac72be768417e2082c889";

export default node;
