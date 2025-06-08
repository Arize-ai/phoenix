/**
 * @generated SignedSource<<9cdc9f7dffc9c104f1a136958f327f2a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UpdateModelMutationInput = {
  cacheReadCostPerToken?: number | null;
  cacheWriteCostPerToken?: number | null;
  completionAudioCostPerToken?: number | null;
  id: string;
  inputCostPerToken: number;
  name: string;
  namePattern: string;
  outputCostPerToken: number;
  promptAudioCostPerToken?: number | null;
  provider?: string | null;
  reasoningCostPerToken?: number | null;
};
export type EditModelButtonMutation$variables = {
  input: UpdateModelMutationInput;
};
export type EditModelButtonMutation$data = {
  readonly updateModel: {
    readonly __typename: "UpdateModelMutationPayload";
  };
};
export type EditModelButtonMutation = {
  response: EditModelButtonMutation$data;
  variables: EditModelButtonMutation$variables;
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
    "concreteType": "UpdateModelMutationPayload",
    "kind": "LinkedField",
    "name": "updateModel",
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
    "name": "EditModelButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditModelButtonMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4ba30f05d810a75896536431322969f6",
    "id": null,
    "metadata": {},
    "name": "EditModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation EditModelButtonMutation(\n  $input: UpdateModelMutationInput!\n) {\n  updateModel(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "761757e8c275275974ae84881e4ed072";

export default node;
