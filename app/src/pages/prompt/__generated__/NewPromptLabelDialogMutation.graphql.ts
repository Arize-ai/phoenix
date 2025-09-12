/**
 * @generated SignedSource<<5f631de8cab3cfc1ba67e21a0c465d98>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreatePromptLabelInput = {
  description?: string | null;
  name: string;
};
export type NewPromptLabelDialogMutation$variables = {
  label: CreatePromptLabelInput;
};
export type NewPromptLabelDialogMutation$data = {
  readonly createPromptLabel: {
    readonly query: {
      readonly __id: string;
    };
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
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "query",
        "plural": false,
        "selections": [
          {
            "kind": "ClientExtension",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__id",
                "storageKey": null
              }
            ]
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
    "cacheID": "3b8e012b561b942a832bd9ca0b20ae89",
    "id": null,
    "metadata": {},
    "name": "NewPromptLabelDialogMutation",
    "operationKind": "mutation",
    "text": null
  }
};
})();

(node as any).hash = "a08d25e8bb62d7652eda5964cd265d77";

export default node;
