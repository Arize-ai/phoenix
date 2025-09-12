/**
 * @generated SignedSource<<fae0b3465c32cf76de44a987b69e0c11>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButtonLabelsQuery$variables = {
  promptId: string;
};
export type PromptLabelConfigButtonLabelsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
};
export type PromptLabelConfigButtonLabelsQuery = {
  response: PromptLabelConfigButtonLabelsQuery$data;
  variables: PromptLabelConfigButtonLabelsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelConfigButtonLabelsQuery",
    "selections": [
      {
        "args": [
          {
            "kind": "Variable",
            "name": "promptId",
            "variableName": "promptId"
          }
        ],
        "kind": "FragmentSpread",
        "name": "PromptLabelConfigButton_labels"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PromptLabelConfigButtonLabelsQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": [
          {
            "kind": "Variable",
            "name": "id",
            "variableName": "promptId"
          }
        ],
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
          {
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
                  (v1/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          },
          (v1/*: any*/)
        ],
        "storageKey": null
      },
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
                  (v1/*: any*/),
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
    ]
  },
  "params": {
    "cacheID": "f4190d9ed6aeee0bd81e7038854cbbc8",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonLabelsQuery",
    "operationKind": "query",
    "text": "query PromptLabelConfigButtonLabelsQuery(\n  $promptId: ID!\n) {\n  ...PromptLabelConfigButton_labels_16seeu\n}\n\nfragment PromptLabelConfigButton_labels_16seeu on Query {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      labels {\n        id\n      }\n    }\n    id\n  }\n  promptLabels {\n    edges {\n      node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fdae943ac8438a04a6bfff8eba2ce4bd";

export default node;
