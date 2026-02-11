/**
 * @generated SignedSource<<bad3979f639994874b99bea8748bdea8>>
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
  connections: ReadonlyArray<string>;
  label: CreatePromptLabelInput;
};
export type NewPromptLabelDialogMutation$data = {
  readonly createPromptLabel: {
    readonly promptLabels: ReadonlyArray<{
      readonly color: string | null;
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type NewPromptLabelDialogMutation = {
  response: NewPromptLabelDialogMutation$data;
  variables: NewPromptLabelDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "label"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "label"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "PromptLabel",
  "kind": "LinkedField",
  "name": "promptLabels",
  "plural": true,
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
      "name": "color",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "NewPromptLabelDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createPromptLabel",
        "plural": false,
        "selections": [
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "NewPromptLabelDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createPromptLabel",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "promptLabels",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "PromptLabelEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c61bebc2bf20d8cf12760e79bfd8205b",
    "id": null,
    "metadata": {},
    "name": "NewPromptLabelDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewPromptLabelDialogMutation(\n  $label: CreatePromptLabelInput!\n) {\n  createPromptLabel(input: $label) {\n    promptLabels {\n      id\n      name\n      color\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ddbd14ff91d53dfbceede5ee349cb9ab";

export default node;
