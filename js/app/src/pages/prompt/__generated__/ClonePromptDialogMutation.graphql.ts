/**
 * @generated SignedSource<<442dc6c52b768c95c2837c85383d4f69>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClonePromptInput = {
  description?: string | null;
  metadata?: any | null;
  name: string;
  promptId: string;
};
export type ClonePromptDialogMutation$variables = {
  input: ClonePromptInput;
};
export type ClonePromptDialogMutation$data = {
  readonly clonePrompt: {
    readonly id: string;
  };
};
export type ClonePromptDialogMutation = {
  response: ClonePromptDialogMutation$data;
  variables: ClonePromptDialogMutation$variables;
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
    "concreteType": "Prompt",
    "kind": "LinkedField",
    "name": "clonePrompt",
    "plural": false,
    "selections": [
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ClonePromptDialogMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ClonePromptDialogMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "6ad0382f6acd0f00125307c887c0f4f2",
    "id": null,
    "metadata": {},
    "name": "ClonePromptDialogMutation",
    "operationKind": "mutation",
    "text": "mutation ClonePromptDialogMutation(\n  $input: ClonePromptInput!\n) {\n  clonePrompt(input: $input) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "081b8cf05c35b46579fe5cbb85f7a761";

export default node;
