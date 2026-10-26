/**
 * @generated SignedSource<<bafe40a3c9109c65a0e3cb9777ea2235>>
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
export type NewPromptVersionTagDialogMutation$variables = {
  input: SetPromptVersionTagInput;
};
export type NewPromptVersionTagDialogMutation$data = {
  readonly setPromptVersionTag: {
    readonly promptVersionTag: {
      readonly id: string;
      readonly name: string;
      readonly promptVersionId: string;
    } | null;
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "promptVersionId",
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
    "name": "NewPromptVersionTagDialogMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "NewPromptVersionTagDialogMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "df5ac258295bdce47280b043147f5e76",
    "id": null,
    "metadata": {},
    "name": "NewPromptVersionTagDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewPromptVersionTagDialogMutation(\n  $input: SetPromptVersionTagInput!\n) {\n  setPromptVersionTag(input: $input) {\n    promptVersionTag {\n      id\n      name\n      promptVersionId\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "477e6cb4227b4970f2f109fae4502d00";

export default node;
