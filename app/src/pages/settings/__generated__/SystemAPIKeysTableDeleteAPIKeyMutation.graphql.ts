/**
 * @generated SignedSource<<57f94610bc0aad56719b10b91acd2b51>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteApiKeyInput = {
  id: string;
};
export type SystemAPIKeysTableDeleteAPIKeyMutation$variables = {
  input: DeleteApiKeyInput;
};
export type SystemAPIKeysTableDeleteAPIKeyMutation$data = {
  readonly deleteSystemApiKey: {
    readonly __typename: "DeleteApiKeyMutationPayload";
    readonly apiKeyId: string;
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
    "cacheID": "a8c45c42b5becca8efa65334285a2f97",
    "id": null,
    "metadata": {},
    "name": "SystemAPIKeysTableDeleteAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation SystemAPIKeysTableDeleteAPIKeyMutation(\n  $input: DeleteApiKeyInput!\n) {\n  deleteSystemApiKey(input: $input) {\n    __typename\n    apiKeyId\n  }\n}\n"
  }
};
})();

(node as any).hash = "55ab8200b5bfda0aa73594ad5cfce96f";

export default node;
