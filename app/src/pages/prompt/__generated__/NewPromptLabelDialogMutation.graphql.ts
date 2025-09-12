/**
 * @generated SignedSource<<ba59be206ca557589f802a1d34ee7449>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreatePromptLabelInput = {
  color: string;
  description?: string | null;
  name: string;
};
export type NewPromptLabelDialogMutation$variables = {
  label: CreatePromptLabelInput;
};
export type NewPromptLabelDialogMutation$data = {
  readonly createPromptLabel: {
    readonly __typename: "PromptLabelMutationPayload";
  };
};
export type NewPromptLabelDialogMutation = {
  response: NewPromptLabelDialogMutation$data;
  variables: NewPromptLabelDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "label"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "label"
      }
    ],
    "concreteType": "PromptLabelMutationPayload",
    "kind": "LinkedField",
    "name": "createPromptLabel",
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
    "name": "NewPromptLabelDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewPromptLabelDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ca28e2c7c50a362ec42a536f0b0e5c02",
    "id": null,
    "metadata": {},
    "name": "NewPromptLabelDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewPromptLabelDialogMutation(\n  $label: CreatePromptLabelInput!\n) {\n  createPromptLabel(input: $label) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "c13fca0dce8f74cd2e0b155e6b71c3d6";

export default node;
