/**
 * @generated SignedSource<<9e952c33593f88c20c63d2dc3f7c3be5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreatePromptLabelInput = {
  color: string;
  description?: string | null;
  name: string;
};
export type NewPromptLabelDialogMutation$variables = {
  label: CreatePromptLabelInput;
};
export type NewPromptLabelDialogMutation$data = {
  readonly createPromptLabel: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "label"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "NewPromptLabelDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptLabelConfigButton_labels"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewPromptLabelDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                "alias": null,
                "args": null,
                "concreteType": "PromptLabelConnection",
                "kind": "LinkedField",
                "name": "promptLabels",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptLabelEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptLabel",
                        "kind": "LinkedField",
                        "name": "node",
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
                            "name": "color",
                            "storageKey": null
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
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "810443e4bcc69652bf548290822d866c",
    "id": null,
    "metadata": {},
    "name": "NewPromptLabelDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewPromptLabelDialogMutation(\n  $label: CreatePromptLabelInput!\n) {\n  createPromptLabel(input: $label) {\n    query {\n      ...PromptLabelConfigButton_labels\n    }\n  }\n}\n\nfragment PromptLabelConfigButton_labels on Query {\n  promptLabels {\n    edges {\n      node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "73a7bac9eda267ba335cb36099e62dd5";

export default node;
