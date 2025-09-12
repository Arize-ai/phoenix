/**
 * @generated SignedSource<<723c697a4299211a662279c42f8686ee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButtonQuery$variables = {
  promptId: string;
};
export type PromptLabelConfigButtonQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
};
export type PromptLabelConfigButtonQuery = {
  response: PromptLabelConfigButtonQuery$data;
  variables: PromptLabelConfigButtonQuery$variables;
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
    "name": "PromptLabelConfigButtonQuery",
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
    "name": "PromptLabelConfigButtonQuery",
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
    "cacheID": "41b2740ceea5df6eb7af18e8dd36de49",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonQuery",
    "operationKind": "query",
    "text": "query PromptLabelConfigButtonQuery(\n  $promptId: ID!\n) {\n  ...PromptLabelConfigButton_labels_16seeu\n}\n\nfragment PromptLabelConfigButton_labels_16seeu on Query {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      labels {\n        id\n      }\n    }\n    id\n  }\n  promptLabels {\n    edges {\n      node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fa3e4b9fa38c12cde1fa82340ca836ff";

export default node;
