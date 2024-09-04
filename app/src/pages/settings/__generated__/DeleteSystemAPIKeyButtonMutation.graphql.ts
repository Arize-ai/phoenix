/**
 * @generated SignedSource<<0d6737ea11f10d62c720159eb3000ba1>>
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
export type DeleteSystemAPIKeyButtonMutation$variables = {
  input: DeleteApiKeyInput;
};
export type DeleteSystemAPIKeyButtonMutation$data = {
  readonly deleteSystemApiKey: {
    readonly __typename: "DeleteApiKeyMutationPayload";
    readonly id: string;
  };
};
export type DeleteSystemAPIKeyButtonMutation = {
  response: DeleteSystemAPIKeyButtonMutation$data;
  variables: DeleteSystemAPIKeyButtonMutation$variables;
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
    "name": "DeleteSystemAPIKeyButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DeleteSystemAPIKeyButtonMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "50908d8736ce33ae7dcbed1f16299d0f",
    "id": null,
    "metadata": {},
    "name": "DeleteSystemAPIKeyButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteSystemAPIKeyButtonMutation(\n  $input: DeleteApiKeyInput!\n) {\n  deleteSystemApiKey(input: $input) {\n    __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "69aa0f424589544652508e589882593b";

export default node;
