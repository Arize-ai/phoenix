/**
 * @generated SignedSource<<ad6d56cebcc55ba847ce7bba879bed6c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SettingsPromptsPageQuery$variables = Record<PropertyKey, never>;
export type SettingsPromptsPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelsSettingsCardFragment">;
};
export type SettingsPromptsPageQuery = {
  response: SettingsPromptsPageQuery$data;
  variables: SettingsPromptsPageQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsPromptsPageQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "PromptLabelsSettingsCardFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SettingsPromptsPageQuery",
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
                    "name": "description",
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
    "cacheID": "0271778f1fb433d3e54c0158957ed284",
    "id": null,
    "metadata": {},
    "name": "SettingsPromptsPageQuery",
    "operationKind": "query",
    "text": "query SettingsPromptsPageQuery {\n  ...PromptLabelsSettingsCardFragment\n}\n\nfragment PromptLabelsSettingsCardFragment on Query {\n  promptLabels {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "ec4e42601216511601fd3c8f10c615fb";

export default node;
