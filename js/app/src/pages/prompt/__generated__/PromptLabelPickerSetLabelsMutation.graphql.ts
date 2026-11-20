/**
 * @generated SignedSource<<782507214f6a4471b894bb5d3d381aa9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptLabelPickerSetLabelsMutation$variables = {
  promptId: string;
  promptLabelIds: ReadonlyArray<string>;
};
export type PromptLabelPickerSetLabelsMutation$data = {
  readonly setPromptLabels: {
    readonly query: {
      readonly node: {
        readonly id?: string;
        readonly labels?: ReadonlyArray<{
          readonly color: string | null;
          readonly id: string;
          readonly name: string;
        }>;
      };
    };
  };
};
export type PromptLabelPickerSetLabelsMutation = {
  response: PromptLabelPickerSetLabelsMutation$data;
  variables: PromptLabelPickerSetLabelsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptLabelIds"
  }
],
v1 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "promptId",
        "variableName": "promptId"
      },
      {
        "kind": "Variable",
        "name": "promptLabelIds",
        "variableName": "promptLabelIds"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "PromptLabel",
  "kind": "LinkedField",
  "name": "labels",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelPickerSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptLabels",
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
                "alias": null,
                "args": (v2/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*:: as any*/),
                      (v4/*:: as any*/)
                    ],
                    "type": "Prompt",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PromptLabelPickerSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptLabels",
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
                "alias": null,
                "args": (v2/*:: as any*/),
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
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v4/*:: as any*/)
                    ],
                    "type": "Prompt",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "00559d005502ff71d0bac929cbd154a6",
    "id": null,
    "metadata": {},
    "name": "PromptLabelPickerSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation PromptLabelPickerSetLabelsMutation(\n  $promptId: ID!\n  $promptLabelIds: [ID!]!\n) {\n  setPromptLabels(input: {promptId: $promptId, promptLabelIds: $promptLabelIds}) {\n    query {\n      node(id: $promptId) {\n        __typename\n        ... on Prompt {\n          id\n          labels {\n            id\n            name\n            color\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e7c4ff049347629f667a68656ecdb431";

export default node;
