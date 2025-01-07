/**
 * @generated SignedSource<<04864df3836436b2353a89b3e6ec6818>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type SetPromptVersionTagInput = {
  description?: string | null;
  name: string;
  promptVersionId: string;
};
export type NewPromptVersionTagDialogMutation$variables = {
  input: SetPromptVersionTagInput;
};
export type NewPromptVersionTagDialogMutation$data = {
  readonly setPromptVersionTag: {
    readonly promptVersionTag: {
      readonly id: string;
    };
  };
};
export type NewPromptVersionTagDialogMutation = {
  response: NewPromptVersionTagDialogMutation$data;
  variables: NewPromptVersionTagDialogMutation$variables;
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
    "concreteType": "PromptVersionTagMutationPayload",
    "kind": "LinkedField",
    "name": "setPromptVersionTag",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "PromptVersionTag",
        "kind": "LinkedField",
        "name": "promptVersionTag",
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "NewPromptVersionTagDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewPromptVersionTagDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4ba60a96d04387340c33e5ed793869c8",
    "id": null,
    "metadata": {},
    "name": "NewPromptVersionTagDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewPromptVersionTagDialogMutation(\n  $input: SetPromptVersionTagInput!\n) {\n  setPromptVersionTag(input: $input) {\n    promptVersionTag {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6b77b7bfa0ea28383f57e61541c5dc0f";

export default node;
