/**
 * @generated SignedSource<<a54006ca4fa2a4ae673ba5ed6bfb6dec>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsPromptsPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsPromptsPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelsSettingsCardFragment" | "PromptLabelsSettingsCardFragment">;
};
export type settingsPromptsPageLoaderQuery = {
  response: settingsPromptsPageLoaderQuery$data;
  variables: settingsPromptsPageLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v1 = [
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
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "usageCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "__typename",
    "storageKey": null
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "PageInfo",
  "kind": "LinkedField",
  "name": "pageInfo",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endCursor",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasNextPage",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "settingsPromptsPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "PromptLabelsSettingsCardFragment"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DecisionLabelsSettingsCardFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsPromptsPageLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
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
                "selections": (v1/*:: as any*/),
                "storageKey": null
              },
              (v2/*:: as any*/)
            ],
            "storageKey": null
          },
          (v3/*:: as any*/)
        ],
        "storageKey": "promptLabels(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "PromptLabelsTable__promptLabels",
        "kind": "LinkedHandle",
        "name": "promptLabels"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "DecisionLabelConnection",
        "kind": "LinkedField",
        "name": "decisionLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DecisionLabelEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionLabel",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": (v1/*:: as any*/),
                "storageKey": null
              },
              (v2/*:: as any*/)
            ],
            "storageKey": null
          },
          (v3/*:: as any*/)
        ],
        "storageKey": "decisionLabels(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "DecisionLabelsTable__decisionLabels",
        "kind": "LinkedHandle",
        "name": "decisionLabels"
      }
    ]
  },
  "params": {
    "cacheID": "4de44cd9e273770de087ea9761d8ee44",
    "id": null,
    "metadata": {},
    "name": "settingsPromptsPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsPromptsPageLoaderQuery {\n  ...PromptLabelsSettingsCardFragment\n  ...DecisionLabelsSettingsCardFragment\n}\n\nfragment DecisionLabelsSettingsCardFragment on Query {\n  ...DecisionLabelsTableFragment\n}\n\nfragment DecisionLabelsTableFragment on Query {\n  decisionLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n        usageCount\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment PromptLabelsSettingsCardFragment on Query {\n  ...PromptLabelsTableFragment\n}\n\nfragment PromptLabelsTableFragment on Query {\n  promptLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n        usageCount\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9e5250e0ba0809e9de5f6f209fa97dff";

export default node;
