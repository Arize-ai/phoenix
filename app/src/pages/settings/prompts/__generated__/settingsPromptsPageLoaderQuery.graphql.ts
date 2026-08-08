/**
 * @generated SignedSource<<09b650a7677aa76dc8eb2bcda09608ec>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsPromptsPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsPromptsPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelsSettingsCardFragment">;
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
];
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
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
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
          }
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
      }
    ]
  },
  "params": {
    "cacheID": "e450d1e4086deef5d9ee322e015d4fa3",
    "id": null,
    "metadata": {},
    "name": "settingsPromptsPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsPromptsPageLoaderQuery {\n  ...PromptLabelsSettingsCardFragment\n}\n\nfragment PromptLabelsSettingsCardFragment on Query {\n  ...PromptLabelsTableFragment\n}\n\nfragment PromptLabelsTableFragment on Query {\n  promptLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n        usageCount\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "44dc2c69c64dbe1d68af886497083b2b";

export default node;
