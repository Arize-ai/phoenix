/**
 * @generated SignedSource<<b586e2699a64acb2bffc82e709eeee3a>>
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
export type TagPromptVersionButtonSetTagMutation$variables = {
  input: SetPromptVersionTagInput;
};
export type TagPromptVersionButtonSetTagMutation$data = {
  readonly setPromptVersionTag: {
    readonly promptVersionTag: {
      readonly id: string;
    };
  };
};
export type TagPromptVersionButtonSetTagMutation = {
  response: TagPromptVersionButtonSetTagMutation$data;
  variables: TagPromptVersionButtonSetTagMutation$variables;
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
    "name": "TagPromptVersionButtonSetTagMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TagPromptVersionButtonSetTagMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a20af942c7ff861c59783f6b5713da4f",
    "id": null,
    "metadata": {},
    "name": "TagPromptVersionButtonSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation TagPromptVersionButtonSetTagMutation(\n  $input: SetPromptVersionTagInput!\n) {\n  setPromptVersionTag(input: $input) {\n    promptVersionTag {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "245a70b9f97ac18d67e049f4e9440c09";

export default node;
