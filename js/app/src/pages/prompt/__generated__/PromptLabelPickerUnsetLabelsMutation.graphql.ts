/**
 * @generated SignedSource<<6e92db184154c44525e1b105d11931eb>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptLabelPickerUnsetLabelsMutation$variables = {
  promptId: string;
  promptLabelIds: ReadonlyArray<string>;
};
export type PromptLabelPickerUnsetLabelsMutation$data = {
  readonly unsetPromptLabels: {
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
export type PromptLabelPickerUnsetLabelsMutation = {
  response: PromptLabelPickerUnsetLabelsMutation$data;
  variables: PromptLabelPickerUnsetLabelsMutation$variables;
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
    "name": "PromptLabelPickerUnsetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "unsetPromptLabels",
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
    "name": "PromptLabelPickerUnsetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "unsetPromptLabels",
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
    "cacheID": "b5276b68a8a41ded1519601e79c6ad14",
    "id": null,
    "metadata": {},
    "name": "PromptLabelPickerUnsetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation PromptLabelPickerUnsetLabelsMutation(\n  $promptId: ID!\n  $promptLabelIds: [ID!]!\n) {\n  unsetPromptLabels(input: {promptId: $promptId, promptLabelIds: $promptLabelIds}) {\n    query {\n      node(id: $promptId) {\n        __typename\n        ... on Prompt {\n          id\n          labels {\n            id\n            name\n            color\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "86edd6a801adeb769e7c6b7c106a283c";

export default node;
