/**
 * @generated SignedSource<<b8ec10e311635010a2ad7fccf77e271b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButtonLabelsQuery$variables = Record<PropertyKey, never>;
export type PromptLabelConfigButtonLabelsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
};
export type PromptLabelConfigButtonLabelsQuery = {
  response: PromptLabelConfigButtonLabelsQuery$data;
  variables: PromptLabelConfigButtonLabelsQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelConfigButtonLabelsQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "PromptLabelConfigButton_labels"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptLabelConfigButtonLabelsQuery",
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
    ]
  },
  "params": {
    "cacheID": "9003544d8e1045d8e35491eb5f0c71ed",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonLabelsQuery",
    "operationKind": "query",
    "text": "query PromptLabelConfigButtonLabelsQuery {\n  ...PromptLabelConfigButton_labels\n}\n\nfragment PromptLabelConfigButton_labels on Query {\n  promptLabels {\n    edges {\n      node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "09b9b768949ee1d5ec9d8b86c5c6e1a4";

export default node;
