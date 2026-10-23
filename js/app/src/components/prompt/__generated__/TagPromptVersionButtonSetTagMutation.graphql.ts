/**
 * @generated SignedSource<<f34dded972ddb80c635b8e75c87b936c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
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
      readonly name: string;
    } | null;
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TagPromptVersionButtonSetTagMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "TagPromptVersionButtonSetTagMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "1beb6404bf5bd56948e20c89e13053a7",
    "id": null,
    "metadata": {},
    "name": "TagPromptVersionButtonSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation TagPromptVersionButtonSetTagMutation(\n  $input: SetPromptVersionTagInput!\n) {\n  setPromptVersionTag(input: $input) {\n    promptVersionTag {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "efa8c165db468f31d3c7269519e880bb";

export default node;
