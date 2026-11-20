/**
 * @generated SignedSource<<856fdd72ee3db303b7a2ccd674403730>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptLabelPickerPromptQuery$variables = {
  promptId: string;
};
export type PromptLabelPickerPromptQuery$data = {
  readonly prompt: {
    readonly labels?: ReadonlyArray<{
      readonly color: string | null;
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type PromptLabelPickerPromptQuery = {
  response: PromptLabelPickerPromptQuery$data;
  variables: PromptLabelPickerPromptQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
        (v2/*:: as any*/),
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
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelPickerPromptQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PromptLabelPickerPromptQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v3/*:: as any*/),
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d0a8c78cacb1f63770400f3c7d75738c",
    "id": null,
    "metadata": {},
    "name": "PromptLabelPickerPromptQuery",
    "operationKind": "query",
    "text": "query PromptLabelPickerPromptQuery(\n  $promptId: ID!\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      labels {\n        id\n        name\n        color\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "a95ede355265286eb5a5da2d56a1bc17";

export default node;
