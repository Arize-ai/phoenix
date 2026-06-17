/**
 * @generated SignedSource<<8cb99f57917ce508464c719753ac5c45>>
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
export type ResourceAccessFormSetTagMutation$variables = {
  input: ResourceTagInput;
};
export type ResourceAccessFormSetTagMutation$data = {
  readonly setResourceTag: {
    readonly __typename: "AccessGrantMutationPayload";
  };
};
export type ResourceAccessFormSetTagMutation = {
  response: ResourceAccessFormSetTagMutation$data;
  variables: ResourceAccessFormSetTagMutation$variables;
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
    "name": "setResourceTag",
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
    "name": "ResourceAccessFormSetTagMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ResourceAccessFormSetTagMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "c4ca65ad8f2be2fd5d0ab2df7bbbef20",
    "id": null,
    "metadata": {},
    "name": "ResourceAccessFormSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation ResourceAccessFormSetTagMutation(\n  $input: ResourceTagInput!\n) {\n  setResourceTag(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "82fb5a6995b38554e2ea4256bfec3bcd";

export default node;
