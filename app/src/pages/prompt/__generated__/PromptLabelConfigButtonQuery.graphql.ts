/**
 * @generated SignedSource<<5e6e72e0735555c027a484e2d7557a89>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButtonQuery$variables = Record<PropertyKey, never>;
export type PromptLabelConfigButtonQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
};
export type PromptLabelConfigButtonQuery = {
  response: PromptLabelConfigButtonQuery$data;
  variables: PromptLabelConfigButtonQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelConfigButtonQuery",
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
    "name": "PromptLabelConfigButtonQuery",
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
    "cacheID": "eae2d6129e01cc4177f0e9ed2e5287a9",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonQuery",
    "operationKind": "query",
    "text": "query PromptLabelConfigButtonQuery {\n  ...PromptLabelConfigButton_labels\n}\n\nfragment PromptLabelConfigButton_labels on Query {\n  promptLabels {\n    edges {\n      node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "0dc224b288b331afbfd4a3e8762f7544";

export default node;
