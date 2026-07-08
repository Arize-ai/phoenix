/**
 * @generated SignedSource<<759ada9658f6eeb55d4b3c1396c48273>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ResourceTagInput = {
  key: string;
  object: AccessGrantObjectInput;
  value?: string | null;
};
export type AccessGrantObjectInput = {
  datasetId?: string | null;
  projectId?: string | null;
  promptId?: string | null;
};
export type ResourceAccessFormRemoveTagMutation$variables = {
  input: ResourceTagInput;
};
export type ResourceAccessFormRemoveTagMutation$data = {
  readonly removeResourceTag: {
    readonly __typename: "AccessGrantMutationPayload";
  };
};
export type ResourceAccessFormRemoveTagMutation = {
  response: ResourceAccessFormRemoveTagMutation$data;
  variables: ResourceAccessFormRemoveTagMutation$variables;
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
    "concreteType": "AccessGrantMutationPayload",
    "kind": "LinkedField",
    "name": "removeResourceTag",
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
    "name": "ResourceAccessFormRemoveTagMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ResourceAccessFormRemoveTagMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e44c9eae1f9765beec1e83620392bf1e",
    "id": null,
    "metadata": {},
    "name": "ResourceAccessFormRemoveTagMutation",
    "operationKind": "mutation",
    "text": "mutation ResourceAccessFormRemoveTagMutation(\n  $input: ResourceTagInput!\n) {\n  removeResourceTag(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "2e3c6a3b6fd988ef233dfe2866da1615";

export default node;
